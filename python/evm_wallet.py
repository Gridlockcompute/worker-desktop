import base64
import json
import os
import re
import time
import urllib.error
import urllib.request
from urllib.parse import quote

import base64
import json
import os
import re
import time
import urllib.error
import urllib.request
from urllib.parse import quote

EVM_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")

_KECCAK_RC = [
    0x0000000000000001, 0x0000000000008082, 0x800000000000808A, 0x8000000080008000,
    0x000000000000808B, 0x0000000080000001, 0x8000000080008081, 0x8000000000008009,
    0x000000000000008A, 0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
    0x000000008000808B, 0x800000000000008B, 0x8000000000008089, 0x8000000000008003,
    0x8000000000008002, 0x8000000000000080, 0x000000000000800A, 0x800000008000000A,
    0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
]

_KECCAK_ROTATIONS = [
    [0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56], [27, 20, 39, 8, 14],
]


def _rotl64(value: int, shift: int) -> int:
    shift %= 64
    return ((value << shift) | (value >> (64 - shift))) & 0xFFFFFFFFFFFFFFFF


def _keccak_f1600(state: list[int]) -> None:
    for round_idx in range(24):
        c = [state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20] for x in range(5)]
        d = [c[(x - 1) % 5] ^ _rotl64(c[(x + 1) % 5], 1) for x in range(5)]
        for x in range(5):
            for y in range(5):
                state[x + 5 * y] ^= d[x]

        b = [0] * 25
        for x in range(5):
            for y in range(5):
                b[y + 5 * ((2 * x + 3 * y) % 5)] = _rotl64(state[x + 5 * y], _KECCAK_ROTATIONS[x][y])

        for x in range(5):
            for y in range(5):
                state[x + 5 * y] = b[x + 5 * y] ^ ((~b[((x + 1) % 5) + 5 * y]) & b[((x + 2) % 5) + 5 * y])

        state[0] ^= _KECCAK_RC[round_idx]


def _keccak256(data: bytes) -> bytes:
    rate = 136
    msg = bytearray(data)
    msg.append(0x01)
    while (len(msg) % rate) != (rate - 1):
        msg.append(0x00)
    msg.append(0x80)

    state = [0] * 25
    for offset in range(0, len(msg), rate):
        block = msg[offset:offset + rate]
        for i in range(min(len(block) // 8, 17)):
            state[i] ^= int.from_bytes(block[i * 8:(i + 1) * 8], byteorder="little")
        _keccak_f1600(state)

    return b"".join(int.to_bytes(state[i], 8, byteorder="little") for i in range(4))


def to_checksum_address(address: str) -> str:
    """EIP-55 mixed-case checksum (matches viem getAddress / router registry)."""
    hex_addr = address.lower().removeprefix("0x")
    hash_hex = _keccak256(hex_addr.encode("ascii")).hex()
    return "0x" + "".join(
        hex_addr[i].upper() if int(hash_hex[i], 16) >= 8 else hex_addr[i]
        for i in range(len(hex_addr))
    )


def normalize_evm_address(raw: str) -> str | None:
    addr = (raw or "").strip()
    if not EVM_ADDRESS_RE.match(addr):
        return None
    return to_checksum_address(addr)


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
