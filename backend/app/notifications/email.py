import os
import smtplib
import socket
import logging
from dataclasses import dataclass
from email.message import EmailMessage
from email import policy
from email.utils import formataddr

from app.core.config import Settings

import dkim


logger = logging.getLogger(__name__)


@dataclass
class MailEnvelope:
    to_address: str
    subject: str
    text_body: str


class MailDeliveryError(RuntimeError):
    pass


class InMemoryMailSender:
    def __init__(self) -> None:
        self.outbox: list[MailEnvelope] = []

    def send(self, envelope: MailEnvelope) -> None:
        self.outbox.append(envelope)


class SmtpMailSender:
    def __init__(
        self,
        *,
        from_name: str,
        from_address: str,
        host: str,
        port: int,
        use_starttls: bool,
        use_ssl: bool = False,
        username: str | None = None,
        password: str | None = None,
        smtp_timeout_seconds: int = 10,
        debug_enabled: bool = False,
        log_enabled: bool = False,
        dkim_enabled: bool = False,
        dkim_domain_name: str | None = None,
        dkim_key_selector: str | None = None,
        dkim_private_key: str | None = None,
        dkim_private_key_path: str | None = None,
    ) -> None:
        self._from_name = from_name
        self._from_address = from_address
        self._host = host
        self._port = port
        self._use_starttls = use_starttls
        self._use_ssl = use_ssl
        self._username = username
        self._password = password
        self._smtp_timeout_seconds = smtp_timeout_seconds
        self._debug_enabled = debug_enabled
        self._log_enabled = log_enabled
        self._dkim_enabled = dkim_enabled
        self._dkim_domain_name = dkim_domain_name
        self._dkim_key_selector = dkim_key_selector
        self._dkim_private_key = dkim_private_key
        self._dkim_private_key_path = dkim_private_key_path

    def _resolve_dkim_private_key(self) -> bytes:
        if self._dkim_private_key:
            normalized = self._dkim_private_key.replace("\\n", "\n").strip()
            return normalized.encode("utf-8")

        if self._dkim_private_key_path:
            with open(self._dkim_private_key_path, "rb") as key_file:
                return key_file.read()

        raise MailDeliveryError("DKIM private key is not configured")

    def _apply_dkim_signature(self, raw_message: bytes) -> bytes:
        if not self._dkim_enabled:
            return raw_message

        if not self._dkim_domain_name or not self._dkim_key_selector:
            raise MailDeliveryError("DKIM domain and selector are required when DKIM is enabled")

        private_key = self._resolve_dkim_private_key()
        dkim_signature = dkim.sign(
            raw_message,
            selector=self._dkim_key_selector.encode("utf-8"),
            domain=self._dkim_domain_name.encode("utf-8"),
            privkey=private_key,
            include_headers=[b"from", b"to", b"subject", b"date", b"message-id"],
        )
        return dkim_signature + raw_message

    def send(self, envelope: MailEnvelope) -> None:
        message = EmailMessage()
        message["From"] = formataddr((self._from_name, self._from_address))
        message["To"] = envelope.to_address
        message["Subject"] = envelope.subject
        message.set_content(envelope.text_body)
        raw_message = message.as_bytes(policy=policy.SMTP)
        signed_message = self._apply_dkim_signature(raw_message)

        if self._log_enabled:
            logger.info(
                "smtp-send:start host=%s port=%s starttls=%s ssl=%s auth=%s dkim=%s timeout=%ss to=%s",
                self._host,
                self._port,
                self._use_starttls,
                self._use_ssl,
                bool(self._username and self._password),
                self._dkim_enabled,
                self._smtp_timeout_seconds,
                envelope.to_address,
            )
        if self._debug_enabled:
            try:
                addresses = socket.getaddrinfo(self._host, self._port, type=socket.SOCK_STREAM)
                resolved = [f"{item[4][0]}:{item[4][1]}" for item in addresses]
                logger.debug("smtp-send:dns host=%s resolved=%s", self._host, resolved)
            except Exception as dns_exc:
                logger.debug("smtp-send:dns-failed host=%s error=%s", self._host, repr(dns_exc))

        try:
            smtp_factory = smtplib.SMTP_SSL if self._use_ssl else smtplib.SMTP
            with smtp_factory(self._host, self._port, timeout=self._smtp_timeout_seconds) as smtp:
                smtp.ehlo()
                if self._debug_enabled:
                    logger.debug("smtp-send:connected host=%s port=%s", self._host, self._port)
                if self._use_starttls and not self._use_ssl:
                    smtp.starttls()
                    smtp.ehlo()
                    if self._debug_enabled:
                        logger.debug("smtp-send:starttls-ok")
                if self._username and self._password:
                    smtp.login(self._username, self._password)
                    if self._debug_enabled:
                        logger.debug("smtp-send:auth-ok")
                smtp.sendmail(self._from_address, [envelope.to_address], signed_message)
                if self._log_enabled:
                    logger.info("smtp-send:success to=%s", envelope.to_address)
        except Exception as exc:
            if self._log_enabled:
                logger.exception("smtp-send:failed host=%s port=%s error=%s", self._host, self._port, repr(exc))
            raise MailDeliveryError(
                f"Unable to deliver email via smtp host={self._host} port={self._port} timeout={self._smtp_timeout_seconds}s error={type(exc).__name__}: {exc}"
            ) from exc


def create_mail_sender(settings: Settings):
    if settings.app_env == "test" or os.getenv("PYTEST_CURRENT_TEST"):
        return InMemoryMailSender()

    if settings.email_delivery_mode == "local":
        return SmtpMailSender(
            from_name=settings.email_from_name,
            from_address=settings.email_from_address,
            host=settings.local_smtp_host,
            port=settings.local_smtp_port,
            use_starttls=settings.local_smtp_use_starttls,
            use_ssl=settings.local_smtp_use_ssl,
            smtp_timeout_seconds=settings.email_smtp_timeout_seconds,
            debug_enabled=settings.email_debug,
            log_enabled=settings.email_logger or settings.email_debug,
            dkim_enabled=settings.email_dkim_enabled,
            dkim_domain_name=settings.email_dkim_domain_name,
            dkim_key_selector=settings.email_dkim_key_selector,
            dkim_private_key=settings.email_dkim_private_key,
            dkim_private_key_path=settings.email_dkim_private_key_path,
        )

    return SmtpMailSender(
        from_name=settings.email_from_name,
        from_address=settings.email_from_address,
        host=settings.external_smtp_host or "",
        port=settings.external_smtp_port,
        use_starttls=settings.external_smtp_use_starttls,
        use_ssl=settings.external_smtp_use_ssl,
        username=settings.external_smtp_username,
        password=settings.external_smtp_password,
        smtp_timeout_seconds=settings.email_smtp_timeout_seconds,
        debug_enabled=settings.email_debug,
        log_enabled=settings.email_logger or settings.email_debug,
        dkim_enabled=settings.email_dkim_enabled,
        dkim_domain_name=settings.email_dkim_domain_name,
        dkim_key_selector=settings.email_dkim_key_selector,
        dkim_private_key=settings.email_dkim_private_key,
        dkim_private_key_path=settings.email_dkim_private_key_path,
    )
