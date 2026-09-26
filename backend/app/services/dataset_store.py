"""Short-lived, process-local datasets keyed by unguessable IDs."""

from collections import OrderedDict
from dataclasses import dataclass
from time import monotonic
from typing import Callable
from uuid import uuid4

import pandas as pd


@dataclass
class DatasetSession:
    df: pd.DataFrame
    feature_columns: list[str]
    label_column: str | None
    last_access: float
    labels: list[int] | None = None


class DatasetStore:
    def __init__(
        self,
        max_sessions: int = 20,
        ttl_seconds: int = 3600,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        self.max_sessions = max_sessions
        self.ttl_seconds = ttl_seconds
        self.clock = clock
        self._sessions: OrderedDict[str, DatasetSession] = OrderedDict()

    def _remove_expired(self, now: float) -> None:
        for dataset_id, session in list(self._sessions.items()):
            if now - session.last_access >= self.ttl_seconds:
                del self._sessions[dataset_id]

    def create(
        self, df: pd.DataFrame, feature_columns: list[str], label_column: str | None
    ) -> str:
        now = self.clock()
        self._remove_expired(now)
        if len(self._sessions) >= self.max_sessions:
            self._sessions.popitem(last=False)

        dataset_id = uuid4().hex
        self._sessions[dataset_id] = DatasetSession(
            df=df,
            feature_columns=feature_columns,
            label_column=label_column,
            last_access=now,
        )
        return dataset_id

    def get(self, dataset_id: str) -> DatasetSession | None:
        now = self.clock()
        self._remove_expired(now)
        session = self._sessions.get(dataset_id)
        if session is not None:
            session.last_access = now
            self._sessions.move_to_end(dataset_id)
        return session
