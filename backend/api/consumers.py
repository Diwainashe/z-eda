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
        # Extract the message data
        data = event['message']

        # You can process the data as needed here
        # For example, send it to the WebSocket client
        await self.send(text_data=json.dumps({
            'type': data['type'],      # This is the nested 'type'
            'message': data['message'] # This is the actual message content
        }))
