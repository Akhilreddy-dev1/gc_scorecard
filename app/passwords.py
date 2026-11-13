"""Hash and verify private group passwords without storing them in plaintext."""

import base64
import argparse
import hashlib
import hmac
import json
import secrets
from getpass import getpass
from pathlib import Path

ALGORITHM = "pbkdf2_sha256"
ITERATIONS = 600_000
MEMBER_IDS = (
    "akhil",
    "varun",
    "yaswanth",
    "binduja",
    "haasini",
    "shreeraj",
    "swejith",
    "hasini",
    "harini",
    "vaagdevi",
    "avinash",
    "dheeraj",
)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return "$".join(
        (
            ALGORITHM,
            str(ITERATIONS),
            base64.urlsafe_b64encode(salt).decode().rstrip("="),
            base64.urlsafe_b64encode(digest).decode().rstrip("="),
        )
    )


def verify_password(password: str, encoded_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_text, digest_text = encoded_hash.split("$", 3)
        iterations = int(iterations_text)
        if algorithm != ALGORITHM or not 100_000 <= iterations <= 2_000_000:
            return False
        salt = base64.urlsafe_b64decode(salt_text + "=" * (-len(salt_text) % 4))
        expected = base64.urlsafe_b64decode(digest_text + "=" * (-len(digest_text) % 4))
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def main() -> None:
    """Generate password hashes or safely migrate a local legacy .env value."""
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--migrate-env",
        action="store_true",
        help="hash MEMBER_PASSWORDS in the repository .env and replace it",
    )
    if parser.parse_args().migrate_env:
        migrate_local_env()
        return

    hashes: dict[str, str] = {}
    for member_id in MEMBER_IDS:
        while True:
            password = getpass(f"Password for {member_id}: ")
            confirmation = getpass("Confirm password: ")
            if password and hmac.compare_digest(password, confirmation):
                hashes[member_id] = hash_password(password)
                break
            print("Passwords must match and cannot be empty. Try again.")
    print("\nSet this JSON as the backend-only MEMBER_PASSWORD_HASHES secret:")
    print(json.dumps(hashes, separators=(",", ":")))


def migrate_local_env() -> None:
    env_path = Path(".env")
    if not env_path.exists():
        raise SystemExit("No .env file found in the current directory.")

    lines = env_path.read_text(encoding="utf-8").splitlines()
    legacy_index = next(
        (index for index, line in enumerate(lines) if line.startswith("MEMBER_PASSWORDS=")),
        None,
    )
    if legacy_index is None:
        raise SystemExit("No legacy MEMBER_PASSWORDS setting found; local .env was not changed.")

    try:
        values = json.loads(lines[legacy_index].split("=", 1)[1])
    except json.JSONDecodeError as error:
        raise SystemExit("Legacy MEMBER_PASSWORDS is not valid JSON; local .env was not changed.") from error
    if not isinstance(values, dict) or set(values) != set(MEMBER_IDS):
        raise SystemExit("Legacy MEMBER_PASSWORDS must contain all 12 member ids; local .env was not changed.")
    if any(not isinstance(value, str) or not value for value in values.values()):
        raise SystemExit("Legacy passwords must be non-empty strings; local .env was not changed.")

    encoded = json.dumps(
        {member_id: hash_password(values[member_id]) for member_id in MEMBER_IDS},
        separators=(",", ":"),
    )
    lines[legacy_index] = f"MEMBER_PASSWORD_HASHES={encoded}"
    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("Local .env passwords were hashed and moved to MEMBER_PASSWORD_HASHES.")
    print("Set the new MEMBER_PASSWORD_HASHES value in your backend deployment secrets too.")


if __name__ == "__main__":
    main()
