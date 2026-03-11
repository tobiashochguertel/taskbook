use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::Instant;

use axum::http::{Request, Response};
use tower::{Layer, Service};

/// Tower [`Layer`] that records HTTP request metrics via the `metrics` crate.
///
/// Recorded instruments:
/// - `http_requests_total` — counter by method, route, status
/// - `http_request_duration_seconds` — histogram by method, route, status
/// - `http_active_requests` — gauge by method, route
#[derive(Clone)]
pub struct HttpMetricsLayer;

impl<S> Layer<S> for HttpMetricsLayer {
    type Service = HttpMetricsService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        HttpMetricsService { inner }
    }
}

#[derive(Clone)]
pub struct HttpMetricsService<S> {
    inner: S,
}

impl<S, ReqBody, ResBody> Service<Request<ReqBody>> for HttpMetricsService<S>
where
    S: Service<Request<ReqBody>, Response = Response<ResBody>> + Clone + Send + 'static,
    S::Future: Send + 'static,
    ReqBody: Send + 'static,
    ResBody: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Request<ReqBody>) -> Self::Future {
        let method = req.method().to_string();
        let route = normalize_path(req.uri().path());

        metrics::gauge!("http_active_requests", "method" => method.clone(), "route" => route.clone()).increment(1.0);

        let mut inner = self.inner.clone();
        let start = Instant::now();

        Box::pin(async move {
            let result = inner.call(req).await;

            let elapsed = start.elapsed().as_secs_f64();
            metrics::gauge!("http_active_requests", "method" => method.clone(), "route" => route.clone()).decrement(1.0);

            let status = match &result {
                Ok(resp) => resp.status().as_u16().to_string(),
                Err(_) => "500".to_string(),
            };

            metrics::counter!("http_requests_total", "method" => method.clone(), "route" => route.clone(), "status" => status.clone()).increment(1);
            metrics::histogram!("http_request_duration_seconds", "method" => method, "route" => route, "status" => status).record(elapsed);

            result
        })
    }
}

/// Normalize the request path for use as a metric label.
///
/// The current API has no path parameters, so paths are used as-is.
/// This stub exists for future-proofing — add normalization here if
/// parameterised routes (e.g. `/items/:id`) are introduced later.
fn normalize_path(path: &str) -> String {
    path.to_string()
}
