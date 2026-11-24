pub mod client;
pub mod oauth;

pub use client::{call_mcp_tool, test_mcp_connection};
pub use oauth::{
    discover_oauth_endpoints, exchange_oauth_code, refresh_oauth_token, register_oauth_client,
    start_oauth_loopback, DynamicClientRegistrationResult, OAuthCallbackResult,
    OAuthDiscoveryResult, OAuthTokenResponse,
};
