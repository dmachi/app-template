# Testing Notification CLI

A command-line tool for sending test notifications to users during development and testing.

## Prerequisites

1. **Configure Testing Credentials** in your `.env` file:
   ```bash
   TESTING_ID=<superuser-user-id>
   TESTING_KEY=<secret-testing-key>
   ```

   - `TESTING_ID`: The user ID of a superuser account (this account's permissions will be used)
   - `TESTING_KEY`: A secret key to authorize testing operations (keep this secure!)

2. **Security Note**: Testing credentials only work when `APP_ENV != production`. In production mode, these credentials are ignored for security.

## Usage

### Basic Usage

Send a simple notification:
```bash
python -m app.cli.send_test_notification <user> "Your notification message"
```

The `<user>` parameter can be:
- User ID (UUID format)
- Username
- Email address

### Options

```bash
python -m app.cli.send_test_notification [OPTIONS] USER MESSAGE

Positional arguments:
  USER                  User identifier: user ID, username, or email
  MESSAGE               Notification message text

Options:
  --require-ack         Require acknowledgement for this notification
  --severity LEVEL      Notification severity: info, success, warning, error (default: info)
  --type TYPE           Notification type (default: test)
  --api-url URL         API base URL (default: http://localhost:8000)
  -h, --help            Show this help message
```

## Examples

### Simple info notification
```bash
python -m app.cli.send_test_notification user@example.com "Your profile was updated"
```

### Warning notification requiring acknowledgement
```bash
python -m app.cli.send_test_notification johndoe "Please review your account settings" \
  --severity warning \
  --require-ack
```

### Error notification with custom type
```bash
python -m app.cli.send_test_notification user123 "Failed to process your request" \
  --severity error \
  --type payment_failed
```

### Success notification to remote API
```bash
python -m app.cli.send_test_notification admin@example.com "Deployment completed successfully" \
  --severity success \
  --api-url https://staging.example.com
```

## How It Works

1. The CLI reads `TESTING_ID` and `TESTING_KEY` from environment variables
2. If the user parameter is not a UUID, it searches for the user via the API
3. It sends a POST request to `/api/v1/notifications` with special headers:
   - `X-Testing-Id`: The testing user ID
   - `X-Testing-Key`: The testing authentication key
4. The API validates these credentials (only in dev/test mode) and uses the testing user's permissions
5. The notification is created and delivered to the target user

## Setting Up Testing Credentials

### Option 1: Add to .env file
```bash
# .env
TESTING_ID=01234567-89ab-cdef-0123-456789abcdef
TESTING_KEY=your-secret-testing-key-here
```

### Option 2: Export as environment variables
```bash
export TESTING_ID=01234567-89ab-cdef-0123-456789abcdef
export TESTING_KEY=your-secret-testing-key-here
```

### Option 3: Inline with command
```bash
TESTING_ID=01234567-89ab-cdef-0123-456789abcdef \
TESTING_KEY=your-secret-key \
python -m app.cli.send_test_notification user@example.com "Test message"
```

## Finding Your Testing User ID

If you have a superuser account, you can find the user ID by:

1. **Via API**: Login and check the `/api/v1/auth/me` endpoint
2. **Via Database**: Query MongoDB for the user
3. **Via Logs**: Check backend logs after login

Example using curl:
```bash
# Login to get access token
TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}' \
  | jq -r '.accessToken')

# Get user details
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.id'
```

## Troubleshooting

### "TESTING_ID and TESTING_KEY environment variables must be set"
- Make sure you have set both environment variables
- Check your `.env` file is in the correct location
- Try exporting the variables directly in your shell

### "Testing user not found"
- Verify the TESTING_ID matches an existing user in your database
- Ensure the user account is active (not disabled)

### "No user found matching..."
- Check the user identifier is correct
- Try using the full email address or exact username
- Try using the user ID directly (UUID format)

### Testing credentials don't work
- Verify `APP_ENV` is set to `development` or `test` (not `production`)
- Check the TESTING_KEY matches exactly (no extra spaces or quotes)
- Ensure the API is running and accessible at the specified URL

## Security Considerations

- **Never use in production**: Testing credentials are disabled in production mode
- **Keep TESTING_KEY secret**: Treat it like a password
- **Use a superuser account**: The TESTING_ID should be a superuser to send notifications
- **Rotate keys regularly**: Change the TESTING_KEY periodically
- **Don't commit to git**: Add `.env` to `.gitignore`
