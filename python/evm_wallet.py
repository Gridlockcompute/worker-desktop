import base64
import json
import os
import re
import time
import urllib.error
import urllib.request
from urllib.parse import quote

EVM_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")


def normalize_evm_address(raw: str) -> str | None:
    addr = (raw or "").strip()
    if not EVM_ADDRESS_RE.match(addr):
        return None
    return addr


def is_valid_evm_address(raw: str) -> bool:
    return normalize_evm_address(raw) is not None


def fetch_attestation_challenge(backend_url: str, wallet: str, ssl_context) -> str:
    url = f"{backend_url.rstrip('/')}/v1/attestation/challenge?wallet={quote(wallet, safe='')}"
    req = urllib.request.Request(url, headers={"User-Agent": "Gridlock-Worker/0.1.0"})
    with urllib.request.urlopen(req, timeout=15, context=ssl_context) as resp:
        data = json.loads(resp.read())
    nonce = data.get("nonce")
    if not nonce:
        raise ValueError("attestation challenge missing nonce")
    return str(nonce)


def load_attestation_quote_from_env() -> dict | None:
    quote_file = (os.getenv("GRIDLOCK_ATTESTATION_QUOTE_FILE") or "").strip()
    if quote_file:
        with open(quote_file, encoding="utf-8") as f:
            return json.load(f)
    quote_json = (os.getenv("GRIDLOCK_ATTESTATION_QUOTE_JSON") or "").strip()
    if quote_json:
        return json.loads(quote_json)
    return None


def build_dev_attestation_quote(wallet: str, nonce: str) -> dict:
    report = f"mock-{wallet.lower()}-{nonce}-{int(time.time() * 1000)}".encode("utf-8")
    return {
        "worker_pubkey": wallet,
        "tee_type": os.getenv("GRIDLOCK_TEE_TYPE", "nvidia_cc"),
        "nonce": nonce,
        "enclave_pubkey": os.getenv("GRIDLOCK_ENCLAVE_PUBKEY", wallet),
        "report_bytes": base64.b64encode(report).decode("ascii"),
        "timestamp": int(time.time() * 1000),
        "certificate_chain": [],
    }


def resolve_registration_attestation_quote(backend_url: str, wallet: str, tee_capable: bool, ssl_context) -> dict | None:
    if not tee_capable:
        return None

    from_env = load_attestation_quote_from_env()
    if from_env:
        return from_env

    try:
        nonce = fetch_attestation_challenge(backend_url, wallet, ssl_context)
        return build_dev_attestation_quote(wallet, nonce)
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, OSError) as error:
        print(json.dumps({"event": "attestation_skipped", "err": str(error)}), flush=True)
        return None
