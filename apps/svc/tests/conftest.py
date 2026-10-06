import os

import pytest

# Set before app.main is imported so every test has a configured key.
TEST_INTERNAL_KEY = "test-internal-key"
os.environ["SVC_INTERNAL_KEY"] = TEST_INTERNAL_KEY


@pytest.fixture
def auth_headers():
    return {"X-Internal-Key": TEST_INTERNAL_KEY}
