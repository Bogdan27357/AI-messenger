"""Microsoft Exchange / Outlook email client for sending and receiving KP."""

import logging
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any
from pathlib import Path

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)


class ExchangeClient:
    """Email client for Outlook/Exchange integration.

    Supports EWS (Exchange Web Services) for sending KP requests
    and monitoring incoming responses.
    """

    def __init__(self):
        self.server = settings.exchange.server
        self.username = settings.exchange.username
        self.password = settings.exchange.password
        self.email = settings.exchange.email

    async def send_kp_request(
        self,
        to_emails: list[str],
        subject: str,
        body_html: str,
        attachments: list[str] | None = None,
        bcc: bool = True,
    ) -> dict[str, Any]:
        """Send a KP request email to suppliers.

        Args:
            to_emails: list of supplier email addresses
            subject: email subject (contains request number)
            body_html: HTML body with KP request template
            attachments: list of file paths to attach (TZ documents)
            bcc: if True, use BCC for supplier addresses
        """
        try:
            from exchangelib import (
                Credentials, Account, Message, HTMLBody,
                FileAttachment, DELEGATE,
            )

            creds = Credentials(username=self.username, password=self.password)
            account = Account(
                primary_smtp_address=self.email,
                credentials=creds,
                autodiscover=False,
                access_type=DELEGATE,
            )

            msg = Message(
                account=account,
                subject=subject,
                body=HTMLBody(body_html),
            )

            if bcc:
                msg.bcc_recipients = to_emails
            else:
                msg.to_recipients = to_emails

            if attachments:
                for file_path in attachments:
                    path = Path(file_path)
                    with open(file_path, "rb") as f:
                        msg.attach(FileAttachment(
                            name=path.name,
                            content=f.read(),
                        ))

            msg.send()
            logger.info("KP request sent to %d recipients, subject: %s", len(to_emails), subject)
            return {"status": "sent", "recipients": len(to_emails), "subject": subject}

        except ImportError:
            logger.warning("exchangelib not available, using SMTP fallback")
            return await self._send_via_smtp(to_emails, subject, body_html, attachments)

    async def _send_via_smtp(
        self,
        to_emails: list[str],
        subject: str,
        body_html: str,
        attachments: list[str] | None = None,
    ) -> dict[str, Any]:
        """Fallback SMTP sender."""
        import aiosmtplib

        msg = MIMEMultipart()
        msg["From"] = self.email
        msg["Subject"] = subject
        msg["Bcc"] = ", ".join(to_emails)
        msg.attach(MIMEText(body_html, "html", "utf-8"))

        if attachments:
            for file_path in attachments:
                path = Path(file_path)
                with open(file_path, "rb") as f:
                    att = MIMEApplication(f.read(), Name=path.name)
                    att["Content-Disposition"] = f'attachment; filename="{path.name}"'
                    msg.attach(att)

        smtp_host = self.server.replace("https://", "").replace("/EWS/Exchange.asmx", "")
        await aiosmtplib.send(
            msg,
            hostname=smtp_host,
            port=587,
            username=self.username,
            password=self.password,
            start_tls=True,
        )
        return {"status": "sent", "recipients": len(to_emails), "method": "smtp"}

    async def fetch_incoming_emails(
        self, subject_filter: str, since_days: int = 7
    ) -> list[dict[str, Any]]:
        """Fetch incoming emails matching a subject filter.

        Used to collect KP responses from suppliers.
        """
        try:
            from exchangelib import (
                Credentials, Account, DELEGATE,
            )
            from datetime import datetime, timedelta, timezone

            creds = Credentials(username=self.username, password=self.password)
            account = Account(
                primary_smtp_address=self.email,
                credentials=creds,
                autodiscover=False,
                access_type=DELEGATE,
            )

            since = datetime.now(timezone.utc) - timedelta(days=since_days)
            items = (
                account.inbox
                .filter(subject__contains=subject_filter, datetime_received__gt=since)
                .order_by("-datetime_received")
            )

            results = []
            for item in items[:50]:
                email_data: dict[str, Any] = {
                    "subject": item.subject,
                    "sender": str(item.sender),
                    "received": str(item.datetime_received),
                    "body": item.text_body or "",
                    "attachments": [],
                }
                for att in item.attachments:
                    if hasattr(att, "content"):
                        email_data["attachments"].append({
                            "name": att.name,
                            "content": att.content,
                            "size": len(att.content),
                        })
                results.append(email_data)

            return results

        except ImportError:
            logger.error("exchangelib required for fetching emails")
            return []


exchange_client = ExchangeClient()
