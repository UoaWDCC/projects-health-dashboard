# Discord

## Overview

The Discord ingestion requires a Discord application with a bot user in order to read messages from the server. The following shows step-by-step instructions for setting one up and integrating it within the codebase.

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and ensure you are signed in.

2. Press the **New Application** button to create a new application, where the name and app icon can be customised.

3. Click on the **Bot** tab and ensure a bot user has been created. The username, icon and banner can also be customised. You will need to copy the bot's token under the **Token** tab. If this is hidden, you will need to regenerate one by pressing **Reset Token**.

4. The copied token should then be pasted into the `DISCORD_BOT_TOKEN` variable in your env file.

5. Ensure the **Message Content Intent** is enabled under **Privileged Gateway Intents**.

6. To generate an invite link to invite the bot to your server, open the **OAuth2** tab, scroll to the **OAuth2 URL Generator** section, and select the `bot` scope. Once the **Bot Permissions** tab appears, select `Administrator`. Ensure the **Integration Type** is set to **Guild Install**, and then the generated URL can be copied. Simply open the URL to invite the bot to the server.

7. Once the bot has been invited to the server, you will need to return to the Discord Developer Portal, open your applications' page, select **None** in **Installation** > **Install Link** and disable **Public Bot** in **Bot** > **Public Bot** to ensure no-one can invite the bot to other servers.

8. The Discord ingestion should now be ready to run.
