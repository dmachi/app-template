from app.core.config import Settings
from app.notifications.email import MailDeliveryError, MailEnvelope


def send_user_invitation(
    *,
    mail_sender,
    settings: Settings,
    invited_email: str,
    inviter_name: str,
    invitation_token: str,
) -> None:
    invitation_link = f"{settings.email_invitation_link_base_url}?token={invitation_token}"

    try:
        mail_sender.send(
            MailEnvelope(
                to_address=invited_email,
                subject=f"You are invited to {settings.app_name}",
                text_body=(
                    f"You have been invited by {inviter_name} to join {settings.app_name}.\n\n"
                    "Use the invitation link below to accept the invitation.\n"
                    "You may login with an existing account, register a new account, or use any enabled external auth method.\n\n"
                    f"{invitation_link}\n"
                ),
            )
        )
    except MailDeliveryError as exc:
        raise MailDeliveryError("Unable to send invitation email") from exc
