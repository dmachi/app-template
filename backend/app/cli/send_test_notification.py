import argparse
import json
import sys
from urllib.parse import urljoin
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from app.core.config import get_settings


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Send a test notification to a user via the API (dev/test only - uses TESTING_ID and TESTING_KEY)"
    )
    parser.add_argument(
        "user_identifier",
        help="User identifier: user ID, username, or email address"
    )
    parser.add_argument(
        "message",
        help="Notification message text"
    )
    parser.add_argument(
        "--require-ack",
        action="store_true",
        help="Require acknowledgement for this notification"
    )
    parser.add_argument(
        "--severity",
        default="info",
        choices=["info", "success", "warning", "error"],
        help="Notification severity level (default: info)"
    )
    parser.add_argument(
        "--type",
        default="test",
        help="Notification type (default: test)"
    )
    parser.add_argument(
        "--api-url",
        default="http://localhost:8000",
        help="API base URL (default: http://localhost:8000)"
    )
    return parser.parse_args(argv)


def resolve_user_id(user_identifier: str, api_url: str, testing_id: str, testing_key: str) -> str:
    """Resolve user identifier to user ID by searching the API."""
    # If it looks like a UUID, assume it's already a user ID
    if len(user_identifier) == 36 and user_identifier.count("-") == 4:
        return user_identifier
    
    # Search for user by query
    search_url = urljoin(api_url, f"/api/v1/users/search?query={user_identifier}")
    req = Request(search_url)
    req.add_header("X-Testing-Id", testing_id)
    req.add_header("X-Testing-Key", testing_key)
    
    try:
        with urlopen(req) as response:
            data = json.loads(response.read().decode("utf-8"))
            users = data.get("items", [])
            
            if not users:
                print(f"Error: No user found matching '{user_identifier}'", file=sys.stderr)
                sys.exit(1)
            
            # Return first match
            user_id = users[0]["id"]
            username = users[0].get("username", "N/A")
            email = users[0].get("email", "N/A")
            print(f"Resolved '{user_identifier}' to user: {username} ({email}) [ID: {user_id}]")
            return user_id
            
    except HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"Error searching for user: {e.code} {e.reason}", file=sys.stderr)
        print(error_body, file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error searching for user: {e}", file=sys.stderr)
        sys.exit(1)


def send_notification(
    user_id: str,
    message: str,
    require_ack: bool,
    severity: str,
    notification_type: str,
    api_url: str,
    testing_id: str,
    testing_key: str,
) -> None:
    """Send a notification via the API."""
    notifications_url = urljoin(api_url, "/api/v1/notifications")
    
    payload = {
        "userIds": [user_id],
        "type": notification_type,
        "message": message,
        "severity": severity,
        "requiresAcknowledgement": require_ack,
        "clearanceMode": "ack" if require_ack else "manual",
    }
    
    req = Request(
        notifications_url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST"
    )
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Testing-Id", testing_id)
    req.add_header("X-Testing-Key", testing_key)
    
    try:
        with urlopen(req) as response:
            result = json.loads(response.read().decode("utf-8"))
            created = result.get("created", [])
            if created:
                notification_id = created[0].get("id", "unknown")
                print(f"✓ Notification sent successfully!")
                print(f"  ID: {notification_id}")
                print(f"  User ID: {user_id}")
                print(f"  Type: {notification_type}")
                print(f"  Severity: {severity}")
                print(f"  Requires Ack: {require_ack}")
                print(f"  Message: {message}")
            else:
                print("Warning: Notification created but no details returned", file=sys.stderr)
                
    except HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"Error sending notification: {e.code} {e.reason}", file=sys.stderr)
        print(error_body, file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error sending notification: {e}", file=sys.stderr)
        sys.exit(1)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    settings = get_settings()

    testing_id = settings.testing_id
    testing_key = settings.testing_key
    
    if not testing_id or not testing_key:
        print("Error: TESTING_ID and TESTING_KEY environment variables must be set", file=sys.stderr)
        print("", file=sys.stderr)
        print("These variables should be configured in your .env file or environment.", file=sys.stderr)
        print("The TESTING_ID should be a superuser user id, username, or email.", file=sys.stderr)
        sys.exit(1)
    
    # Resolve user identifier to user ID
    user_id = resolve_user_id(args.user_identifier, args.api_url, testing_id, testing_key)
    
    # Send the notification
    send_notification(
        user_id=user_id,
        message=args.message,
        require_ack=args.require_ack,
        severity=args.severity,
        notification_type=args.type,
        api_url=args.api_url,
        testing_id=testing_id,
        testing_key=testing_key,
    )


if __name__ == "__main__":
    main()
