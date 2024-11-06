# api/consumers.py

import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ValidationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.validation_id = self.scope['url_route']['kwargs']['validation_id']
        self.group_name = f'validation_{self.validation_id}'

        # Join validation group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave validation group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    # Handler for messages sent to the group with type 'validation_message'
    async def validation_message(self, event):
        try:
            # Ensure event['message'] is parsed if it's a JSON string
            data = event['message']
            if isinstance(data, str):
                data = json.loads(data)  # Parse JSON string to dictionary

            # Send parsed data to the WebSocket client
            await self.send(text_data=json.dumps({
                'type': data.get('type'),
                'message': data.get('message')
            }))
        except json.JSONDecodeError as e:
            print(f"JSON decoding error: {e}")
        except Exception as e:
            print(f"Unexpected error in validation_message: {e}")
