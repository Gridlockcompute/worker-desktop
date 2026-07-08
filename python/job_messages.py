"""Worker job message contract — mirror of gridlock-web/src/lib/job-messages.ts.

Every job includes the full conversation in messages[]. Workers are stateless;
do not rely on prior jobs for context.
"""

from __future__ import annotations

def prepare_inference_messages(
    job_messages: list[dict],
    *,
    system_prompt: str | None = None,
) -> list[dict]:
    """Normalize job messages for vLLM / Ollama / llama.cpp chat APIs."""
    system = system_prompt or (
        "You do not have access to the current date, time, or live information. "
        "If asked for today's date, say you do not know the current date."
    )
    turns = [
        {"role": m["role"], "content": m["content"]}
        for m in job_messages
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]
    return [{"role": "system", "content": system}, *turns]
