"""Bootstrap Agent: Seed prompt -> FactoryConfig generation.

Implements rule-based analysis of a seed prompt to determine project domain,
target audience, features, complexity, and team composition. No LLM calls
are needed — the bootstrap is fast and deterministic.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import yaml

from .config import (
    AgentConfig,
    BudgetConfig,
    CompanyConfig,
    FactoryConfig,
    GuardrailConfig,
    ModelTier,
    OrgConfig,
    PersonaRef,
    ProviderConfig,
    RuntimeConfig,
    WorkflowConfig,
)


# ---------------------------------------------------------------------------
# Seed Analysis
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class SeedAnalysis:
    """Analysis of a seed prompt."""

    domain: str               # saas, ecommerce, content, marketplace, devtool, mobile-app
    target_audience: str      # Who is the target customer
    key_features: tuple[str, ...]  # Inferred key features
    complexity: str           # simple, medium, complex
    needs_ui: bool            # Does it need a user interface?
    needs_monetization: bool  # Does it need pricing/payment?
    needs_marketing: bool     # Does it need marketing strategy?
    company_name: str         # Generated company name


DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "saas": [
        "saas", "subscription", "dashboard", "analytics", "tracking",
        "management", "platform", "tool", "app",
    ],
    "ecommerce": [
        "shop", "store", "ecommerce", "e-commerce", "sell",
        "marketplace", "product listing",
    ],
    "content": [
        "blog", "content", "media", "publishing", "newsletter", "cms",
    ],
    "marketplace": [
        "marketplace", "two-sided", "matching", "connect buyers",
        "connect sellers",
    ],
    "devtool": [
        "developer", "api", "sdk", "cli", "library", "framework",
        "devtool", "open source",
    ],
    "mobile-app": ["mobile", "ios", "android", "app store"],
}

AUDIENCE_KEYWORDS: dict[str, list[str]] = {
    "freelancers": ["freelancer", "freelance", "independent"],
    "small businesses": ["small business", "smb", "startup", "small team"],
    "enterprises": ["enterprise", "corporate", "large organization"],
    "developers": ["developer", "programmer", "engineer", "devs"],
    "creators": ["creator", "artist", "designer", "content creator"],
    "students": ["student", "education", "learning", "academic"],
    "general consumers": ["consumer", "everyone", "personal", "individual"],
}

FEATURE_KEYWORDS: dict[str, list[str]] = {
    "Real-time notifications": ["real-time", "notification", "alert"],
    "Analytics dashboard": ["analytics", "metrics", "reporting", "tracking"],
    "Team collaboration": ["team", "collaboration", "shared", "multi-user"],
    "API integration": ["api", "integration", "connect", "webhook"],
    "Mobile responsive": ["mobile", "responsive", "cross-platform"],
    "Payment processing": ["payment", "billing", "subscription", "pricing"],
    "Search functionality": ["search", "filter", "find"],
    "Export and reporting": ["export", "report", "csv", "pdf"],
}

DOMAIN_DEFAULT_FEATURES: dict[str, list[str]] = {
    "saas": ["User authentication", "Dashboard", "Data management"],
    "ecommerce": ["Product catalog", "Shopping cart", "Payment processing"],
    "content": ["Content editor", "Publishing workflow", "SEO optimization"],
    "devtool": ["CLI interface", "API documentation", "Package management"],
    "marketplace": ["User profiles", "Search and discovery", "Transaction management"],
    "mobile-app": ["User authentication", "Push notifications", "Offline support"],
}

COMPLEXITY_INDICATORS: list[str] = [
    "enterprise", "real-time", "machine learning", "ai",
    "blockchain", "distributed",
]

NO_UI_INDICATORS: list[str] = ["api", "cli", "sdk", "library", "backend", "service"]

# These use word-boundary patterns to avoid false matches (e.g. "free" in "freelancer")
_FREE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bopen source\b"),
    re.compile(r"\bfree\b"),
    re.compile(r"\bnon-profit\b"),
    re.compile(r"\binternal tool\b"),
]

_NO_MARKETING_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\binternal\b"),
    re.compile(r"\bprivate\b"),
    re.compile(r"\bpersonal\b"),
]

STOP_WORDS: frozenset[str] = frozenset({
    "a", "an", "the", "for", "to", "and", "or", "in", "on", "at", "by",
    "with", "that", "this", "is", "build", "create", "make", "develop",
})

MAX_FEATURES = 8


def analyze_seed(seed_prompt: str) -> SeedAnalysis:
    """Analyze a seed prompt to extract domain, audience, features, and complexity."""
    seed_lower = seed_prompt.lower()

    domain = _detect_domain(seed_lower)
    target_audience = _detect_audience(seed_lower)
    key_features = _detect_features(seed_lower, domain)
    complexity = _assess_complexity(seed_lower, key_features)

    return SeedAnalysis(
        domain=domain,
        target_audience=target_audience,
        key_features=tuple(key_features),
        complexity=complexity,
        needs_ui=_needs_ui(seed_lower),
        needs_monetization=_needs_monetization(seed_lower),
        needs_marketing=_needs_marketing(seed_lower),
        company_name=_generate_company_name(seed_prompt),
    )


def _detect_domain(seed_lower: str) -> str:
    """Detect the project domain from seed keywords."""
    scores: dict[str, int] = {}
    for domain, keywords in DOMAIN_KEYWORDS.items():
        scores[domain] = sum(1 for kw in keywords if kw in seed_lower)

    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] > 0 else "saas"


def _detect_audience(seed_lower: str) -> str:
    """Detect target audience from seed."""
    for audience, keywords in AUDIENCE_KEYWORDS.items():
        if any(kw in seed_lower for kw in keywords):
            return audience
    return "general users"


def _detect_features(seed_lower: str, domain: str) -> list[str]:
    """Infer key features based on seed and domain."""
    features = list(DOMAIN_DEFAULT_FEATURES.get(domain, []))

    for feature, keywords in FEATURE_KEYWORDS.items():
        if any(kw in seed_lower for kw in keywords) and feature not in features:
            features.append(feature)

    return features[:MAX_FEATURES]


def _assess_complexity(seed_lower: str, features: list[str]) -> str:
    """Assess project complexity based on features and indicators."""
    score = len(features)
    score += sum(2 for ind in COMPLEXITY_INDICATORS if ind in seed_lower)

    if score <= 3:
        return "simple"
    if score <= 6:
        return "medium"
    return "complex"


def _needs_ui(seed_lower: str) -> bool:
    """Determine whether the project requires a user interface."""
    return not any(ind in seed_lower for ind in NO_UI_INDICATORS)


def _needs_monetization(seed_lower: str) -> bool:
    """Determine whether the project needs monetization."""
    return not any(p.search(seed_lower) for p in _FREE_PATTERNS)


def _needs_marketing(seed_lower: str) -> bool:
    """Determine whether the project needs marketing."""
    return not any(p.search(seed_lower) for p in _NO_MARKETING_PATTERNS)


def _generate_company_name(seed_prompt: str) -> str:
    """Generate a company name from meaningful words in the seed prompt."""
    words = [
        w for w in seed_prompt.split()
        if w.lower() not in STOP_WORDS and len(w) > 2
    ]

    if len(words) >= 2:
        return f"{words[0].capitalize()}{words[1].capitalize()} AI Co."
    if words:
        return f"{words[0].capitalize()} AI Co."
    return "AutoFactory AI Co."


# ---------------------------------------------------------------------------
# Role Selection
# ---------------------------------------------------------------------------

MINIMUM_ROLES: list[str] = ["ceo", "fullstack", "devops"]

ROLE_CONDITIONS: dict[str, callable] = {
    "critic": lambda a: a.complexity in ("medium", "complex"),
    "cto": lambda a: a.complexity == "complex",
    "product": lambda a: a.needs_ui,
    "ui": lambda a: a.needs_ui,
    "interaction": lambda a: a.needs_ui and a.complexity == "complex",
    "qa": lambda a: a.complexity in ("medium", "complex"),
    "marketing": lambda a: a.needs_marketing,
    "operations": lambda a: a.needs_marketing,
    "sales": lambda a: a.needs_monetization,
    "cfo": lambda a: a.needs_monetization,
    "research": lambda a: a.complexity in ("medium", "complex"),
}

ROLE_TO_PERSONA: dict[str, str] = {
    "ceo": "jeff-bezos",
    "cto": "werner-vogels",
    "critic": "charlie-munger",
    "product": "don-norman",
    "ui": "matias-duarte",
    "interaction": "alan-cooper",
    "fullstack": "dhh",
    "qa": "james-bach",
    "devops": "kelsey-hightower",
    "marketing": "seth-godin",
    "operations": "paul-graham",
    "sales": "aaron-ross",
    "cfo": "patrick-campbell",
    "research": "ben-thompson",
}

ROLE_LAYERS: dict[str, str] = {
    "ceo": "strategy",
    "cto": "strategy",
    "critic": "strategy",
    "product": "product",
    "ui": "product",
    "interaction": "product",
    "fullstack": "engineering",
    "qa": "engineering",
    "devops": "engineering",
    "marketing": "business",
    "operations": "business",
    "sales": "business",
    "cfo": "business",
    "research": "intelligence",
}

ROLE_MODELS: dict[str, ModelTier] = {
    "ceo": ModelTier.OPUS,
    "cto": ModelTier.OPUS,
    "critic": ModelTier.OPUS,
    "research": ModelTier.OPUS,
    "product": ModelTier.SONNET,
    "ui": ModelTier.SONNET,
    "interaction": ModelTier.SONNET,
    "fullstack": ModelTier.SONNET,
    "qa": ModelTier.SONNET,
    "devops": ModelTier.SONNET,
    "marketing": ModelTier.SONNET,
    "operations": ModelTier.SONNET,
    "sales": ModelTier.HAIKU,
    "cfo": ModelTier.SONNET,
}


def select_roles(analysis: SeedAnalysis) -> list[str]:
    """Select which roles are needed based on seed analysis."""
    roles = list(MINIMUM_ROLES)

    for role, condition in ROLE_CONDITIONS.items():
        if role not in roles and condition(analysis):
            roles.append(role)

    return roles


# ---------------------------------------------------------------------------
# Agent Building
# ---------------------------------------------------------------------------

def _load_persona_skills(persona_id: str, library_dir: Path) -> list[str]:
    """Load recommended skills from a persona YAML file."""
    persona_path = library_dir / "personas" / f"{persona_id}.yaml"
    if not persona_path.exists():
        return []

    with open(persona_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    return list(data.get("recommended_skills", []))


def build_agents(roles: list[str], library_dir: Path) -> list[AgentConfig]:
    """Build AgentConfig list from selected roles."""
    agents: list[AgentConfig] = []

    for role in roles:
        persona_id = ROLE_TO_PERSONA.get(role, role)
        skills = _load_persona_skills(persona_id, library_dir)

        agents.append(AgentConfig(
            role=role,
            persona=PersonaRef(id=persona_id),
            skills=skills,
            model=ROLE_MODELS.get(role, ModelTier.SONNET),
            layer=ROLE_LAYERS.get(role, "engineering"),
        ))

    return agents


# ---------------------------------------------------------------------------
# Workflow Selection
# ---------------------------------------------------------------------------

def _extract_chain_roles(chain_data: list) -> list[str]:
    """Extract role names from a workflow chain (list of dicts or strings)."""
    roles: list[str] = []
    for item in chain_data:
        if isinstance(item, dict):
            role = item.get("role", "")
            if role:
                roles.append(role)
        elif isinstance(item, str):
            roles.append(item)
    return roles


# Mapping from workflow YAML role names to our internal role names
_WORKFLOW_ROLE_ALIASES: dict[str, str] = {
    "research-analyst": "research",
    "product-designer": "product",
    "interaction-designer": "interaction",
    "lead-developer": "fullstack",
    "qa-lead": "qa",
    "devops-sre": "devops",
    "cmo": "marketing",
    "sales-lead": "sales",
}


def _normalize_role(role: str) -> str:
    """Normalize a workflow role name to our internal role identifier."""
    return _WORKFLOW_ROLE_ALIASES.get(role, role)


def select_workflows(
    roles: list[str], library_dir: Path,
) -> list[WorkflowConfig]:
    """Select and load workflows that can be executed by the selected roles."""
    workflows: list[WorkflowConfig] = []
    workflow_dir = library_dir / "workflows"

    if not workflow_dir.exists():
        return workflows

    for wf_file in sorted(workflow_dir.glob("*.yaml")):
        with open(wf_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        if data is None:
            continue

        raw_chain = data.get("chain", [])
        chain_roles = _extract_chain_roles(raw_chain)
        normalized = [_normalize_role(r) for r in chain_roles]

        # Only include workflow if all normalized chain roles are selected
        if normalized and all(r in roles for r in normalized):
            workflows.append(WorkflowConfig(
                id=data["id"],
                name=data["name"],
                description=data.get("description", ""),
                chain=normalized,
                convergence_cycles=data.get("convergence_cycles", 3),
            ))

    return workflows


# ---------------------------------------------------------------------------
# Main Entry Point
# ---------------------------------------------------------------------------

def generate_config(
    seed_prompt: str,
    library_dir: Optional[Path] = None,
) -> FactoryConfig:
    """Main bootstrap entry: seed prompt -> complete FactoryConfig.

    This is the primary public API. Given a natural-language seed prompt,
    it produces a fully-populated FactoryConfig ready for the generator.
    """
    if library_dir is None:
        library_dir = Path(__file__).parent.parent / "library"

    analysis = analyze_seed(seed_prompt)
    roles = select_roles(analysis)
    agents = build_agents(roles, library_dir)
    workflows = select_workflows(roles, library_dir)

    return FactoryConfig(
        company=CompanyConfig(
            name=analysis.company_name,
            mission=(
                f"Build and ship a profitable {analysis.domain} product: "
                f"{seed_prompt}"
            ),
            description=(
                f"Domain: {analysis.domain}. "
                f"Target: {analysis.target_audience}. "
                f"Complexity: {analysis.complexity}."
            ),
            seed_prompt=seed_prompt,
        ),
        org=OrgConfig(agents=agents),
        workflows=workflows,
        runtime=RuntimeConfig(
            providers=[ProviderConfig()],
            budget=BudgetConfig(),
            loop_interval=30,
            cycle_timeout=1800,
        ),
        guardrails=GuardrailConfig(),
    )
