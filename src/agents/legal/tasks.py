"""Celery tasks for the Legal expertise agent.

Exposes async agent methods as synchronous Celery tasks
that run on the ``legal`` queue.
"""

import asyncio
import logging

from src.core.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from a synchronous Celery worker context."""
    return asyncio.run(coro)


@celery_app.task(
    name="src.agents.legal.tasks.analyze_contract",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    queue="legal",
)
def analyze_contract(self, contract_id: str, file_path: str) -> dict:
    """Celery task: run full contract analysis pipeline.

    Args:
        contract_id: Unique contract identifier.
        file_path: Local path to the contract file.

    Returns:
        Structured analysis report dict.
    """
    from src.agents.legal.agent import legal_agent

    logger.info(
        "Task analyze_contract started: contract_id=%s, file=%s",
        contract_id, file_path,
    )
    try:
        result = _run_async(legal_agent.analyze_contract(contract_id, file_path))
        logger.info(
            "Task analyze_contract finished: contract_id=%s, status=%s",
            contract_id, result.get("overall_status"),
        )
        return result
    except Exception as exc:
        logger.exception(
            "Task analyze_contract failed: contract_id=%s", contract_id,
        )
        raise self.retry(exc=exc)


@celery_app.task(
    name="src.agents.legal.tasks.index_legal_standards",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    queue="legal",
)
def index_legal_standards(self, directory: str) -> dict:
    """Celery task: index legal standard documents from a directory.

    Args:
        directory: Path to directory containing DOCX/PDF standard files.

    Returns:
        Summary dict with indexed/failed counts.
    """
    from src.agents.legal.agent import legal_agent

    logger.info("Task index_legal_standards started: directory=%s", directory)
    try:
        result = _run_async(legal_agent.index_legal_standards(directory))
        logger.info(
            "Task index_legal_standards finished: indexed=%d, failed=%d",
            result.get("indexed", 0), result.get("failed", 0),
        )
        return result
    except Exception as exc:
        logger.exception(
            "Task index_legal_standards failed: directory=%s", directory,
        )
        raise self.retry(exc=exc)


@celery_app.task(
    name="src.agents.legal.tasks.check_counterparty",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    queue="legal",
)
def check_counterparty(self, inn: str) -> dict:
    """Celery task: run full counterparty verification.

    Args:
        inn: Taxpayer Identification Number (INN).

    Returns:
        Combined check results from EGRUL, KAD, bankruptcy, and FNS.
    """
    from src.agents.legal.agent import legal_agent

    logger.info("Task check_counterparty started: INN=%s", inn)
    try:
        result = _run_async(legal_agent.check_counterparty(inn))
        logger.info(
            "Task check_counterparty finished: INN=%s, risk=%s",
            inn, result.get("overall_risk"),
        )
        return result
    except Exception as exc:
        logger.exception("Task check_counterparty failed: INN=%s", inn)
        raise self.retry(exc=exc)
