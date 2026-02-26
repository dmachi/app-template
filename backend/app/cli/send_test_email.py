import argparse
import logging
from datetime import UTC, datetime

from app.core.config import get_settings
from app.notifications.email import MailEnvelope, create_mail_sender


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Send a test email using configured backend mail settings")
    parser.add_argument("to_email", help="Destination email address")
    parser.add_argument(
        "--subject",
        default="Basic System Template - Test Email",
        help="Optional email subject",
    )
    parser.add_argument(
        "--body",
        default=None,
        help="Optional plain-text email body",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    settings = get_settings()

    if settings.email_debug or settings.email_logger:
        logging.basicConfig(
            level=logging.DEBUG if settings.email_debug else logging.INFO,
            format="%(asctime)s %(levelname)s %(name)s - %(message)s",
        )

    mail_sender = create_mail_sender(settings)

    body = args.body or (
        "This is a test email from Basic System Template.\n\n"
        f"Sent at: {datetime.now(UTC).isoformat()}\n"
        f"Delivery mode: {settings.email_delivery_mode}\n"
        f"DKIM enabled: {settings.email_dkim_enabled}\n"
    )

    envelope = MailEnvelope(
        to_address=args.to_email,
        subject=args.subject,
        text_body=body,
    )
    mail_sender.send(envelope)

    print(f"send-test-email: sent to {args.to_email}")


if __name__ == "__main__":
    main()
