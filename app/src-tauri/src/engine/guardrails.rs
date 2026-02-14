use regex::Regex;
use crate::models::GuardrailConfig;

const DEFAULT_FORBIDDEN: &[&str] = &[
    "gh repo delete",
    "wrangler delete",
    "rm -rf /",
    "git push --force main",
    "git push --force master",
    "git reset --hard",
];

const DANGEROUS_PATTERNS: &[&str] = &[
    r"rm\s+-rf\s+/",
    r"dd\s+if=.+of=/dev/",
    r"mkfs\.",
    r":()\{.*\|.*&\s*\};:",
    r"chmod\s+-R\s+777\s+/",
    r"curl.*\|\s*bash",
    r"wget.*\|\s*sh",
];

pub fn check_command_safety(command: &str, config: &GuardrailConfig) -> Result<(), String> {
    // Check forbidden commands
    for forbidden in &config.forbidden {
        if command.contains(forbidden) {
            return Err(format!("Forbidden command detected: {}", forbidden));
        }
    }

    // Check default forbidden
    for forbidden in DEFAULT_FORBIDDEN {
        if command.contains(forbidden) {
            return Err(format!("Dangerous command blocked: {}", forbidden));
        }
    }

    // Check dangerous patterns
    for pattern in DANGEROUS_PATTERNS {
        if let Ok(re) = Regex::new(pattern) {
            if re.is_match(command) {
                return Err(format!("Dangerous pattern detected: {}", pattern));
            }
        }
    }

    Ok(())
}

pub fn validate_config_guardrails(config: &GuardrailConfig) -> Vec<String> {
    let mut warnings = Vec::new();

    if config.forbidden.is_empty() {
        warnings.push("No forbidden commands configured. Consider adding safety guardrails.".to_string());
    }

    if !config.require_critic_review {
        warnings.push("Critic review is disabled. Risky decisions may go unchecked.".to_string());
    }

    if config.workspace.is_empty() {
        warnings.push("No workspace boundary set. Agents may write files anywhere.".to_string());
    }

    warnings
}
