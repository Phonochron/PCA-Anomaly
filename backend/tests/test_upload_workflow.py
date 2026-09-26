"""Regression tests for isolated upload, run, and export workflows."""

import io
import unittest

from fastapi import UploadFile
from fastapi.exceptions import HTTPException

from app.api import routes
from app.api.schemas import RunRequest
from app.services.dataset_store import DatasetStore

CSV_A = b"a,b,c,d\n1,2,3,4\n2,3,5,7\n3,5,8,13\n5,8,13,21\n8,13,21,34\n"
CSV_B = b"x,y,z,w\n2,4,1,9\n3,5,2,8\n5,7,4,6\n7,9,6,4\n11,13,8,2\n"


class UploadWorkflowTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        routes.dataset_store = DatasetStore()

    async def upload(self, name, content):
        return await routes.upload_csv(
            UploadFile(filename=name, file=io.BytesIO(content)),
            label_column=None,
            encoding="utf-8",
        )

    async def test_two_datasets_keep_independent_results_and_exports(self):
        first_id = (await self.upload("first.csv", CSV_A)).dataset_id
        second_id = (await self.upload("second.csv", CSV_B)).dataset_id
        self.assertNotEqual(first_id, second_id)

        first = await routes.run_anomaly_detection(dataset_id=first_id)
        with self.assertRaises(HTTPException):
            await routes.download_anomalies_csv(dataset_id=second_id)

        second = await routes.run_anomaly_detection(dataset_id=second_id)
        self.assertEqual(first.feature_names, ["a", "b", "c", "d"])
        self.assertEqual(second.feature_names, ["x", "y", "z", "w"])
        self.assertEqual(routes.get_dataset(first_id).labels, first.labels)
        self.assertEqual(routes.get_dataset(second_id).labels, second.labels)

        first_export = await routes.download_cleaned_csv(dataset_id=first_id)
        second_export = await routes.download_cleaned_csv(dataset_id=second_id)
        first_csv = first_export.body
        second_csv = second_export.body
        self.assertTrue(first_csv.startswith(b"a,b,c,d"))
        self.assertTrue(second_csv.startswith(b"x,y,z,w"))

    async def test_failed_upload_does_not_change_existing_dataset(self):
        first_id = (await self.upload("first.csv", CSV_A)).dataset_id
        await routes.run_anomaly_detection(dataset_id=first_id)

        with self.assertRaises(HTTPException):
            await self.upload("invalid.txt", CSV_B)
        self.assertIsNotNone(routes.get_dataset(first_id).labels)
        await routes.download_cleaned_csv(dataset_id=first_id)

    async def test_failed_rerun_only_invalidates_its_dataset(self):
        first_id = (await self.upload("first.csv", CSV_A)).dataset_id
        second_id = (await self.upload("second.csv", CSV_B)).dataset_id
        await routes.run_anomaly_detection(dataset_id=first_id)
        await routes.run_anomaly_detection(dataset_id=second_id)

        with self.assertRaises(HTTPException):
            await routes.run_anomaly_detection(
                RunRequest(n_components=4), dataset_id=first_id
            )
        with self.assertRaises(HTTPException):
            await routes.download_cleaned_csv(dataset_id=first_id)
        await routes.download_cleaned_csv(dataset_id=second_id)

    async def test_unknown_dataset_id_is_rejected(self):
        with self.assertRaises(HTTPException) as caught:
            await routes.run_anomaly_detection(dataset_id="not-a-dataset")
        self.assertEqual(caught.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
