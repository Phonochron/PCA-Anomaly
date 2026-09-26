"""Cross-origin access is limited to configured frontend origins."""

import unittest

import httpx

from app.config import settings
from app.main import app


class CorsTests(unittest.IsolatedAsyncioTestCase):
    async def test_preflight_allows_configured_origin_and_dataset_header(self):
        origin = settings.cors_origins[0]
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.options(
                "/api/run",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "content-type,x-dataset-id",
                },
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["access-control-allow-origin"], origin)

    async def test_preflight_rejects_unknown_origin(self):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.options(
                "/api/run",
                headers={
                    "Origin": "https://unconfigured.invalid",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "x-dataset-id",
                },
            )
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("access-control-allow-origin", response.headers)


if __name__ == "__main__":
    unittest.main()
