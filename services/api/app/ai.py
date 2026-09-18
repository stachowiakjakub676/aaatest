"""Explanation layer (phase 7).

The language model only ever sees the structured AnalysisReport produced by the deterministic
chemistry layer and returns prose plus optional *structured* suggestions. It never receives the
authority to change anything: the client validates every suggestion against the live molecule
and applies it only after the user confirms.

Provider selection: ``MCAD_AI_PROVIDER=anthropic`` enables the Anthropic provider (credentials
resolved by the SDK from the environment); anything else leaves the endpoint disabled (503).
"""

from __future__ import annotations

import json
import os
from typing import Any, Protocol

from pydantic import BaseModel, Field

MODEL_ID = "claude-opus-5"

SYSTEM_PROMPT = """You explain computational chemistry results to a chemist using Molecular CAD.

You receive a JSON report produced by deterministic software (RDKit descriptors, structural
validation, rule checks). Rules:
- Use only numbers that appear in the report. Never invent, estimate or "predict" values.
- Say that descriptors are computed, not measured. Do not describe biological activity, toxicity
  or efficacy; rule checks such as Lipinski's rule of five are heuristics, say so.
- Do not describe synthesis routes, reagents, reaction conditions or procedures.
- Keep the explanation under 200 words, plain language, no headings.
- Optional suggestions must be structural edits the user might want, expressed only with these
  operations and only with atom/bond ids that appear in the report: setElement, setCharge,
  removeAtom, removeBond, setBondOrder, addBondedAtom, addHydrogens, tidy. Suggest nothing when
  nothing is clearly useful. Suggestions are proposals; the user decides."""


class SuggestionOut(BaseModel):
    title: str
    rationale: str = ""
    operations: list[dict[str, Any]] = Field(default_factory=list)


class ExplanationOut(BaseModel):
    text: str
    suggestions: list[SuggestionOut] = Field(default_factory=list)


class ExplanationProvider(Protocol):
    name: str

    def explain(self, report: dict[str, Any]) -> ExplanationOut: ...


class AnthropicProvider:
    """Calls Claude through the official SDK with a structured (JSON schema) output."""

    name = MODEL_ID

    def __init__(self) -> None:
        import anthropic  # imported lazily so the API runs without the SDK installed

        self._client = anthropic.Anthropic()

    def explain(self, report: dict[str, Any]) -> ExplanationOut:
        response = self._client.messages.parse(
            model=MODEL_ID,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": "Explain this report:\n" + json.dumps(report, ensure_ascii=False)}],
            output_format=ExplanationOut,
        )
        if response.stop_reason == "refusal":
            raise RuntimeError("The model declined to answer this request.")
        parsed = response.parsed_output
        if parsed is None:
            raise RuntimeError("The model returned no structured output.")
        return parsed


class DisabledProvider:
    name = "disabled"

    def explain(self, report: dict[str, Any]) -> ExplanationOut:  # pragma: no cover - guarded by the endpoint
        raise RuntimeError("No AI provider configured. Set MCAD_AI_PROVIDER=anthropic and provide Anthropic credentials.")


def provider_from_env() -> ExplanationProvider:
    if os.environ.get("MCAD_AI_PROVIDER", "").lower() == "anthropic":
        return AnthropicProvider()
    return DisabledProvider()
