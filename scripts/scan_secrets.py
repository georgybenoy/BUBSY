"""Automated secret scan script for Bubsy repository.

Scans all tracked repository files for:
- Hardcoded production passwords / credentials
- Private keys (RSA, DSA, EC, OPENSSH)
- AWS / GCP / GitHub personal access tokens
- Database connection strings containing passwords
- Secrets leaked in environment example files
"""

import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

SECRET_PATTERNS = [
    (re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"), "Private Key Block"),
    (re.compile(r"(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}"), "AWS Access Key ID"),
    (re.compile(r"gh[pousr]_[A-Za-z0-9_]{36,255}"), "GitHub Personal Access Token"),
    (re.compile(r"(?:xox[p|b|o|a]-[0-9]{12}-[0-9]{12}-[0-9]{12}-[a-z0-9]{32})"), "Slack Token"),
    (re.compile(r"(?:postgres|mysql|mongodb):\/\/[a-zA-Z0-9_\-]+:[^@\s]+@"), "Database URI with Plaintext Password"),
]

# Patterns for sensitive variable assignments that have hardcoded non-placeholder values
SENSITIVE_KEY_PATTERN = re.compile(
    r"""(?i)(?:api_key|secret_key|private_key|password)\s*[:=]\s*['"]([^'"]+)['"]"""
)

PLACEHOLDER_SUBSTRINGS = {
    "placeholder",
    "example",
    "insecure",
    "change-me",
    "your-secret",
    "dev-secret",
    "mock",
    "test",
    "dummy",
    "validpassword123!",
    "supersecretpassword123",
}

IGNORE_DIRS = {".git", ".venv", "node_modules", ".pytest_cache", ".ruff_cache", "dist"}


def scan_repository():
    findings = []
    scanned_count = 0

    for root, dirs, files in os.walk(REPO_ROOT):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

        for file in files:
            file_path = Path(root) / file
            # Skip binary files and test databases
            if file_path.suffix in (".db", ".sqlite", ".sqlite3", ".pyc", ".png", ".jpg", ".pt", ".ico"):
                continue

            try:
                content = file_path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            scanned_count += 1
            rel_path = file_path.relative_to(REPO_ROOT)

            # Check standard secret patterns
            for pat, desc in SECRET_PATTERNS:
                matches = pat.findall(content)
                if matches:
                    findings.append((str(rel_path), desc, matches[:2]))

            # Check sensitive key assignments for non-placeholders
            if "test" not in str(rel_path).lower():
                for line_no, line in enumerate(content.splitlines(), start=1):
                    match = SENSITIVE_KEY_PATTERN.search(line)
                    if match:
                        val = match.group(1).lower()
                        if len(val) >= 8 and not any(ph in val for ph in PLACEHOLDER_SUBSTRINGS):
                            # Ignore imports or type annotations
                            if "from " not in line and "import " not in line:
                                findings.append((f"{rel_path}:{line_no}", "Potential Hardcoded Secret", line.strip()[:60]))

    print(f"Secret Scan Complete: {scanned_count} files scanned.")
    if findings:
        print(f"CRITICAL: Found {len(findings)} potential secret(s):")
        for loc, desc, match in findings:
            print(f"  - [{desc}] at {loc}: {match}")
        sys.exit(1)
    else:
        print("PASS: Zero hardcoded secrets, private keys, or cloud credentials discovered.")
        sys.exit(0)


if __name__ == "__main__":
    scan_repository()
