#!/usr/bin/env python3
"""
Generate VAPID keys for Web Push notifications.

Usage:
    python generate_vapid.py

Copy the output into your .env file.
Requires the 'cryptography' package (already in requirements.txt).
"""
import base64
from cryptography.hazmat.primitives.asymmetric.ec import generate_private_key, SECP256R1
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    PrivateFormat,
    PublicFormat,
    NoEncryption,
)

private_key = generate_private_key(SECP256R1())
public_key = private_key.public_key()

# PEM private key — flatten newlines for single-line .env storage
private_pem = private_key.private_bytes(
    Encoding.PEM, PrivateFormat.TraditionalOpenSSL, NoEncryption()
).decode()
private_env = private_pem.replace("\n", "\\n")

# Uncompressed public key point, URL-safe base64 (browser applicationServerKey)
public_bytes = public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
public_b64 = base64.urlsafe_b64encode(public_bytes).rstrip(b"=").decode()

print("# ── Add these lines to your .env file ──────────────────────────────")
print(f"VAPID_PRIVATE_KEY={private_env}")
print(f"VAPID_PUBLIC_KEY={public_b64}")
print("VAPID_EMAIL=your@email.com")
print()
print("# ── Quick test (after docker compose up) ───────────────────────────")
print("# curl -X POST http://localhost/api/push/test -H 'Authorization: Bearer <token>'")
