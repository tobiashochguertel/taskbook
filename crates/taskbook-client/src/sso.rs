//! Browser-based OIDC/SSO login for the CLI.
//!
//! Flow:
//! 1. Start a local HTTP server on 127.0.0.1:PORT
//! 2. Open browser to server's OIDC login with redirect_uri → localhost callback
//! 3. After OIDC, server redirects to http://127.0.0.1:PORT/callback#token=...
//! 4. Local server serves HTML that reads the fragment and POSTs it back
//! 5. CLI captures the token, saves credentials, exits
//!
//! Fallback (headless/SSH):
//! - If browser can't be opened, print the URL for manual copy
//! - User can also use `tb --set-token` to paste a token from the WebUI

use std::io::{Read, Write};
use std::net::TcpListener;

use crate::error::{Result, TaskbookError};

const CALLBACK_PORT: u16 = 18900;
const CALLBACK_PORT_MAX: u16 = 18910;
const HTTP_READ_BUFFER_SIZE: usize = 8192;

/// Callback HTML page that extracts the URL fragment and POSTs it to /complete.
const CALLBACK_HTML: &str = r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Taskbook — Completing login...</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 4rem auto; text-align: center; background: #0f1117; color: #e2e8f0; }
    .spinner { font-size: 2rem; animation: spin 1s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .success { color: #68d391; font-size: 1.5rem; }
    .error { color: #fc8181; }
  </style>
</head>
<body>
  <div id="status"><span class="spinner">⏳</span><p>Completing login...</p></div>
  <script>
    (async () => {
      try {
        const params = new URLSearchParams(location.hash.substring(1));
        const token = params.get('token');
        if (!token) {
          document.getElementById('status').innerHTML = '<p class="error">No token received. Please try again.</p>';
          return;
        }
        const data = { token: token, encryption_key: params.get('encryption_key') || null, new_user: params.get('new_user') === 'true' };
        await fetch('/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        document.getElementById('status').innerHTML = '<p class="success">✅ Login successful!</p><p>You can close this tab.</p>';
      } catch (e) {
        document.getElementById('status').innerHTML = '<p class="error">Error: ' + e.message + '</p>';
      }
    })();
  </script>
</body>
</html>"#;

/// Result of a successful SSO callback.
pub struct SsoResult {
    pub token: String,
    pub encryption_key: Option<String>,
    pub is_new_user: bool,
}

/// Start the SSO login flow: bind local server, open browser, wait for callback.
/// Returns the token and optional encryption key on success.
pub fn run_sso_flow(server_url: &str) -> Result<SsoResult> {
    let (listener, port) = bind_callback_server()?;

    let callback_uri = format!("http://127.0.0.1:{}/callback", port);
    let login_url = format!(
        "{}/auth/oidc/login?redirect_uri={}",
        server_url.trim_end_matches('/'),
        urlencoding::encode(&callback_uri)
    );

    // Try to open browser
    let browser_opened = open::that(&login_url).is_ok();

    if browser_opened {
        println!("Opening browser for SSO login...");
    } else {
        println!("Could not open browser automatically.");
        println!();
        println!("Open this URL in your browser:");
        println!("  {}", login_url);
    }
    println!();
    println!("Waiting for authentication (press Ctrl+C to cancel)...");

    // Accept connections until we get the token
    let result = wait_for_callback(&listener)?;

    Ok(result)
}

/// Bind to a local port for the OIDC callback.
fn bind_callback_server() -> Result<(TcpListener, u16)> {
    for port in CALLBACK_PORT..=CALLBACK_PORT_MAX {
        match TcpListener::bind(format!("127.0.0.1:{}", port)) {
            Ok(listener) => return Ok((listener, port)),
            Err(_) => continue,
        }
    }
    Err(TaskbookError::General(format!(
        "Could not bind to any port in range {}-{}. \
         Use `tb --set-token` as an alternative.",
        CALLBACK_PORT, CALLBACK_PORT_MAX
    )))
}

/// Wait for the browser callback and extract the token.
fn wait_for_callback(listener: &TcpListener) -> Result<SsoResult> {
    loop {
        let (mut stream, _) = listener
            .accept()
            .map_err(|e| TaskbookError::General(format!("accept failed: {e}")))?;

        let mut buf = vec![0u8; HTTP_READ_BUFFER_SIZE];
        let n = stream
            .read(&mut buf)
            .map_err(|e| TaskbookError::General(format!("read failed: {e}")))?;
        let request = String::from_utf8_lossy(&buf[..n]);

        if request.starts_with("GET /callback") {
            // Serve the HTML that extracts the fragment
            let response = format!(
                "HTTP/1.1 200 OK\r\n\
                 Content-Type: text/html; charset=utf-8\r\n\
                 Content-Length: {}\r\n\
                 Connection: close\r\n\r\n{}",
                CALLBACK_HTML.len(),
                CALLBACK_HTML
            );
            let _ = stream.write_all(response.as_bytes());
            let _ = stream.flush();
            drop(stream);
        } else if request.starts_with("POST /complete") {
            // Extract the JSON body from the POST request
            if let Some(body) = request.split("\r\n\r\n").nth(1) {
                let parsed: std::result::Result<serde_json::Value, _> =
                    serde_json::from_str(body.trim_end_matches('\0'));

                if let Ok(json) = parsed {
                    let token = json["token"].as_str().unwrap_or("").to_string();
                    if token.is_empty() {
                        let response = "HTTP/1.1 400 Bad Request\r\n\
                                       Content-Length: 16\r\n\
                                       Connection: close\r\n\r\n\
                                       {\"error\":\"no token\"}";
                        let _ = stream.write_all(response.as_bytes());
                        continue;
                    }

                    let encryption_key = json["encryption_key"]
                        .as_str()
                        .filter(|s| !s.is_empty())
                        .map(|s| s.to_string());
                    let is_new_user = json["new_user"].as_bool().unwrap_or(false);

                    // Send success response
                    let ok_body = r#"{"ok":true}"#;
                    let response = format!(
                        "HTTP/1.1 200 OK\r\n\
                         Content-Type: application/json\r\n\
                         Content-Length: {}\r\n\
                         Connection: close\r\n\r\n{}",
                        ok_body.len(),
                        ok_body
                    );
                    let _ = stream.write_all(response.as_bytes());
                    let _ = stream.flush();

                    return Ok(SsoResult {
                        token,
                        encryption_key,
                        is_new_user,
                    });
                }
            }

            let response = "HTTP/1.1 400 Bad Request\r\n\
                           Content-Length: 22\r\n\
                           Connection: close\r\n\r\n\
                           {\"error\":\"bad request\"}";
            let _ = stream.write_all(response.as_bytes());
        } else {
            // Unknown request — ignore (favicon, etc.)
            let response = "HTTP/1.1 404 Not Found\r\n\
                           Content-Length: 0\r\n\
                           Connection: close\r\n\r\n";
            let _ = stream.write_all(response.as_bytes());
        }
    }
}
