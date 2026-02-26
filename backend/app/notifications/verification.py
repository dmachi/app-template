from app.auth.security import generate_email_verification_token
from app.core.config import Settings
from app.notifications.email import MailDeliveryError, MailEnvelope


def send_email_verification(*, mail_sender, settings: Settings, user_id: str, email: str, display_name: str) -> None:
    verification_token, _ = generate_email_verification_token(user_id, email, settings)
    verification_link = f"{settings.email_verification_link_base_url}?token={verification_token}"

    try:
        mail_sender.send(
            MailEnvelope(
                to_address=email,
                subject=f"Verify your email for {settings.app_name}",
                text_body=(
                    f"Hello {display_name},\n\n"
                    "Please verify your email address by visiting the link below:\n"
                    f"{verification_link}\n\n"
                    "If you did not create this account, you can ignore this message."
                ),
            )
        )
    except MailDeliveryError as exc:
        raise MailDeliveryError("Unable to send verification email") from exc
