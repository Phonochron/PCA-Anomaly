"""Dataset retention bounds for the process-local demo store."""

import unittest

import pandas as pd

from app.services.dataset_store import DatasetStore


class DatasetStoreTests(unittest.TestCase):
    def setUp(self):
        self.now = 0.0
        self.store = DatasetStore(max_sessions=2, ttl_seconds=10, clock=lambda: self.now)
        self.df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})

    def create(self):
        return self.store.create(self.df, ["a", "b"], None)

    def test_expiration_uses_last_access(self):
        dataset_id = self.create()
        self.now = 9
        self.assertIsNotNone(self.store.get(dataset_id))
        self.now = 18
        self.assertIsNotNone(self.store.get(dataset_id))
        self.now = 28
        self.assertIsNone(self.store.get(dataset_id))

    def test_oldest_session_is_evicted_at_capacity(self):
        first = self.create()
        second = self.create()
        self.store.get(first)
        third = self.create()
        self.assertIsNone(self.store.get(second))
        self.assertIsNotNone(self.store.get(first))
        self.assertIsNotNone(self.store.get(third))


if __name__ == "__main__":
    unittest.main()
