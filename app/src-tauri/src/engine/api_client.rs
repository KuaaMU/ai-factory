use serde::{Deserialize, Serialize};
use std::time::Duration;

// ===== Anthropic API Types =====

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<ApiMessage>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ApiMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<ContentBlock>,
    usage: AnthropicUsage,
}

#[derive(Debug, Deserialize)]
struct ContentBlock {
    #[serde(default)]
    text: Option<String>,
    #[serde(rename = "type")]
    content_type: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicUsage {
    input_tokens: u32,
    output_tokens: u32,
}

// ===== OpenAI API Types =====

#[derive(Debug, Serialize)]
struct OpenAiRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<ApiMessage>,
}

#[derive(Debug, Deserialize)]
struct OpenAiResponse {
    choices: Vec<OpenAiChoice>,
    usage: OpenAiUsage,
}

#[derive(Debug, Deserialize)]
struct OpenAiChoice {
    message: OpenAiMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAiMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAiUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
}

// ===== Public Types =====

pub struct CycleResponse {
    pub text: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
}

// ===== Anthropic API =====

pub fn call_anthropic(
    api_key: &str,
    api_base_url: &str,
    model: &str,
    system_prompt: &str,
    user_message: &str,
    timeout_secs: u32,
) -> Result<CycleResponse, String> {
    let url = format!("{}/v1/messages", api_base_url.trim_end_matches('/'));
    let resolved_model = resolve_anthropic_model(model);

    let body = AnthropicRequest {
        model: resolved_model,
        max_tokens: 4096,
        system: system_prompt.to_string(),
        messages: vec![ApiMessage {
            role: "user".to_string(),
            content: user_message.to_string(),
        }],
    };

    let agent = ureq::AgentBuilder::new()
        .timeout_read(Duration::from_secs(timeout_secs as u64))
        .timeout_write(Duration::from_secs(30))
        .build();

    let result = agent
        .post(&url)
        .set("x-api-key", api_key)
        .set("anthropic-version", "2023-06-01")
        .set("content-type", "application/json")
        .send_json(&body);

    match result {
        Ok(resp) => {
            let data: AnthropicResponse = resp
                .into_json()
                .map_err(|e| format!("Failed to parse Anthropic response: {}", e))?;

            let text = data
                .content
                .into_iter()
                .filter_map(|c| {
                    if c.content_type == "text" {
                        c.text
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
                .join("");

            Ok(CycleResponse {
                text,
                input_tokens: data.usage.input_tokens,
                output_tokens: data.usage.output_tokens,
            })
        }
        Err(ureq::Error::Status(code, resp)) => {
            let error_body = resp.into_string().unwrap_or_default();
            let preview = truncate(&error_body, 500);
            Err(format!("Anthropic API error (HTTP {}): {}", code, preview))
        }
        Err(e) => Err(format!("Anthropic request failed: {}", e)),
    }
}

// ===== OpenAI API =====

pub fn call_openai(
    api_key: &str,
    api_base_url: &str,
    model: &str,
    system_prompt: &str,
    user_message: &str,
    timeout_secs: u32,
) -> Result<CycleResponse, String> {
    let url = format!(
        "{}/v1/chat/completions",
        api_base_url.trim_end_matches('/')
    );

    let body = OpenAiRequest {
        model: model.to_string(),
        max_tokens: 4096,
        messages: vec![
            ApiMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            ApiMessage {
                role: "user".to_string(),
                content: user_message.to_string(),
            },
        ],
    };

    let agent = ureq::AgentBuilder::new()
        .timeout_read(Duration::from_secs(timeout_secs as u64))
        .timeout_write(Duration::from_secs(30))
        .build();

    let result = agent
        .post(&url)
        .set("Authorization", &format!("Bearer {}", api_key))
        .set("content-type", "application/json")
        .send_json(&body);

    match result {
        Ok(resp) => {
            let data: OpenAiResponse = resp
                .into_json()
                .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

            let text = data
                .choices
                .first()
                .and_then(|c| c.message.content.clone())
                .unwrap_or_default();

            Ok(CycleResponse {
                text,
                input_tokens: data.usage.prompt_tokens,
                output_tokens: data.usage.completion_tokens,
            })
        }
        Err(ureq::Error::Status(code, resp)) => {
            let error_body = resp.into_string().unwrap_or_default();
            let preview = truncate(&error_body, 500);
            Err(format!("OpenAI API error (HTTP {}): {}", code, preview))
        }
        Err(e) => Err(format!("OpenAI request failed: {}", e)),
    }
}

// ===== Model Resolution =====

fn resolve_anthropic_model(model: &str) -> String {
    match model {
        "opus" => "claude-opus-4-20250514".to_string(),
        "sonnet" => "claude-sonnet-4-20250514".to_string(),
        "haiku" => "claude-3-5-haiku-20241022".to_string(),
        other => other.to_string(),
    }
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len])
    }
}
