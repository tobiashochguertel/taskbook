use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Taskbook Server API",
        description = "REST API for taskbook sync — tasks, boards & notes",
        version = "1.3.2",
        license(name = "MIT"),
    ),
    paths(
        crate::handlers::health::root_info,
        crate::handlers::health::health,
        crate::handlers::user::register,
        crate::handlers::user::login,
        crate::handlers::user::logout,
        crate::handlers::user::me,
        crate::handlers::user::update_me,
        crate::handlers::user::get_encryption_key_status,
        crate::handlers::user::store_encryption_key,
        crate::handlers::user::reset_encryption_key,
        crate::handlers::items::get_items,
        crate::handlers::items::put_items,
        crate::handlers::items::get_archive,
        crate::handlers::items::put_archive,
        crate::handlers::tokens::create_token,
        crate::handlers::tokens::list_tokens,
        crate::handlers::tokens::revoke_token,
    ),
    components(schemas(
        crate::handlers::user::RegisterRequest,
        crate::handlers::user::RegisterResponse,
        crate::handlers::user::LoginRequest,
        crate::handlers::user::LoginResponse,
        crate::handlers::user::MeResponse,
        crate::handlers::user::UpdateMeRequest,
        crate::handlers::user::UpdateMeResponse,
        crate::handlers::user::EncryptionKeyStatus,
        crate::handlers::user::StoreKeyRequest,
        crate::handlers::items::EncryptedItemData,
        crate::handlers::items::ItemsResponse,
        crate::handlers::items::PutItemsRequest,
        crate::handlers::tokens::CreateTokenRequest,
        crate::handlers::tokens::CreateTokenResponse,
        crate::handlers::tokens::TokenInfo,
        crate::handlers::tokens::TokenListResponse,
    )),
    tags(
        (name = "system", description = "Health and system endpoints"),
        (name = "auth", description = "Authentication (register, login, logout)"),
        (name = "items", description = "Encrypted item sync"),
        (name = "encryption", description = "Encryption key management"),
        (name = "tokens", description = "Personal Access Token management"),
    ),
    modifiers(&SecurityAddon)
)]
pub struct ApiDoc;

struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "bearer",
                utoipa::openapi::security::SecurityScheme::Http(
                    utoipa::openapi::security::Http::new(
                        utoipa::openapi::security::HttpAuthScheme::Bearer,
                    ),
                ),
            );
        }
    }
}
