use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::error::{Result, TaskbookError};

/// HTTP client for communicating with the taskbook server.
pub struct ApiClient {
    base_url: String,
    token: Option<String>,
    client: reqwest::blocking::Client,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct EncryptedItemData {
    pub data: String,
    pub nonce: String,
}

#[derive(Deserialize)]
pub struct ItemsResponse {
    pub items: HashMap<String, EncryptedItemData>,
}

#[derive(Serialize)]
struct PutItemsRequest {
    items: HashMap<String, EncryptedItemData>,
}

#[derive(Serialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct RegisterResponse {
    pub token: String,
}

#[derive(Serialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct LoginResponse {
    pub token: String,
}

#[derive(Deserialize)]
pub struct MeResponse {
    pub username: String,
    pub email: String,
}

#[derive(Deserialize)]
struct ErrorResponse {
    error: String,
}

impl ApiClient {
    pub fn new(base_url: &str, token: Option<&str>) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            token: token.map(|t| t.to_string()),
            client: reqwest::blocking::Client::new(),
        }
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    fn auth_header(&self) -> Result<String> {
        self.token
            .as_ref()
            .map(|t| format!("Bearer {}", t))
            .ok_or_else(|| TaskbookError::Auth("not logged in".to_string()))
    }

    /// Extract error details from a non-success response.
    fn error_from_response(resp: reqwest::blocking::Response, fallback: &str) -> TaskbookError {
        let status = resp.status();
        let detail = resp
            .json::<ErrorResponse>()
            .map(|e| e.error)
            .unwrap_or_else(|_| fallback.to_string());
        if status == reqwest::StatusCode::UNAUTHORIZED {
            TaskbookError::Auth(format!(
                "{} (session may have expired — try `tb --login`)",
                detail
            ))
        } else {
            TaskbookError::Network(format!("{} (HTTP {})", detail, status.as_u16()))
        }
    }

    pub fn register(&self, req: &RegisterRequest) -> Result<RegisterResponse> {
        let resp = self
            .client
            .post(self.url("/api/v1/register"))
            .json(req)
            .send()
            .map_err(|e| TaskbookError::Network(e.to_string()))?;

        if resp.status().is_success() {
            resp.json::<RegisterResponse>()
                .map_err(|e| TaskbookError::Network(e.to_string()))
        } else {
            Err(Self::error_from_response(resp, "registration failed"))
        }
    }

    pub fn login(&self, req: &LoginRequest) -> Result<LoginResponse> {
        let resp = self
            .client
            .post(self.url("/api/v1/login"))
            .json(req)
            .send()
            .map_err(|e| TaskbookError::Network(e.to_string()))?;

        if resp.status().is_success() {
            resp.json::<LoginResponse>()
                .map_err(|e| TaskbookError::Network(e.to_string()))
        } else {
            Err(Self::error_from_response(resp, "login failed"))
        }
    }

    pub fn logout(&self) -> Result<()> {
        let auth = self.auth_header()?;
        let resp = self
            .client
            .delete(self.url("/api/v1/logout"))
            .header("Authorization", &auth)
            .send()
            .map_err(|e| TaskbookError::Network(e.to_string()))?;

        if resp.status().is_success() {
            Ok(())
        } else {
            Err(Self::error_from_response(resp, "logout failed"))
        }
    }

    pub fn get_me(&self) -> Result<MeResponse> {
        let auth = self.auth_header()?;
        let resp = self
            .client
            .get(self.url("/api/v1/me"))
            .header("Authorization", &auth)
            .send()
            .map_err(|e| TaskbookError::Network(e.to_string()))?;

        if resp.status().is_success() {
            resp.json::<MeResponse>()
                .map_err(|e| TaskbookError::Network(e.to_string()))
        } else {
            Err(Self::error_from_response(resp, "failed to get user info"))
        }
    }

    pub fn get_items(&self) -> Result<HashMap<String, EncryptedItemData>> {
        let auth = self.auth_header()?;
        let resp = self
            .client
            .get(self.url("/api/v1/items"))
            .header("Authorization", &auth)
            .send()
            .map_err(|e| TaskbookError::Network(e.to_string()))?;

        if resp.status().is_success() {
            let body: ItemsResponse = resp
                .json()
                .map_err(|e| TaskbookError::Network(e.to_string()))?;
            Ok(body.items)
        } else {
            Err(Self::error_from_response(resp, "failed to fetch items"))
        }
    }

    pub fn put_items(&self, items: &HashMap<String, EncryptedItemData>) -> Result<()> {
        let auth = self.auth_header()?;
        let req = PutItemsRequest {
            items: items.clone(),
        };
        let resp = self
            .client
            .put(self.url("/api/v1/items"))
            .header("Authorization", &auth)
            .json(&req)
            .send()
            .map_err(|e| TaskbookError::Network(e.to_string()))?;

        if resp.status().is_success() {
            Ok(())
        } else {
            Err(Self::error_from_response(resp, "failed to save items"))
        }
    }

    pub fn get_archive(&self) -> Result<HashMap<String, EncryptedItemData>> {
        let auth = self.auth_header()?;
        let resp = self
            .client
            .get(self.url("/api/v1/items/archive"))
            .header("Authorization", &auth)
            .send()
            .map_err(|e| TaskbookError::Network(e.to_string()))?;

        if resp.status().is_success() {
            let body: ItemsResponse = resp
                .json()
                .map_err(|e| TaskbookError::Network(e.to_string()))?;
            Ok(body.items)
        } else {
            Err(Self::error_from_response(resp, "failed to fetch archive"))
        }
    }

    pub fn delete_path(&self, path: &str) -> Result<()> {
        let auth = self.auth_header()?;
        let resp = self
            .client
            .delete(self.url(path))
            .header("Authorization", &auth)
            .send()
            .map_err(|e| TaskbookError::Network(e.to_string()))?;

        if resp.status().is_success() {
            Ok(())
        } else {
            Err(Self::error_from_response(resp, "delete request failed"))
        }
    }

    pub fn post_json(&self, path: &str, body: &serde_json::Value) -> Result<()> {
        let auth = self.auth_header()?;
        let resp = self
            .client
            .post(self.url(path))
            .header("Authorization", &auth)
            .json(body)
            .send()
            .map_err(|e| TaskbookError::Network(e.to_string()))?;

        if resp.status().is_success() {
            Ok(())
        } else {
            Err(Self::error_from_response(resp, "post request failed"))
        }
    }

    pub fn put_archive(&self, items: &HashMap<String, EncryptedItemData>) -> Result<()> {
        let auth = self.auth_header()?;
        let req = PutItemsRequest {
            items: items.clone(),
        };
        let resp = self
            .client
            .put(self.url("/api/v1/items/archive"))
            .header("Authorization", &auth)
            .json(&req)
            .send()
            .map_err(|e| TaskbookError::Network(e.to_string()))?;

        if resp.status().is_success() {
            Ok(())
        } else {
            Err(Self::error_from_response(resp, "failed to save archive"))
        }
    }
}
