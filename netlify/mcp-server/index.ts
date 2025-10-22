import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export const setupMCPServer = (): McpServer => {
	const server = new McpServer(
		{
			name: 'stateless-server',
			version: '1.0.0',
		},
		{ capabilities: { logging: {} } }
	)

	// Register a prompt template that allows the server to
	// provide the context structure and (optionally) the variables
	// that should be placed inside of the prompt for client to fill in.
	server.registerPrompt(
		'greeting-template',
		{
			title: 'Greeting Template',
			description: 'A simple greeting prompt template',
			argsSchema: {
				name: z.string().describe('Name to include in greeting'),
			},
		},
		({ name }) => ({
			messages: [
				{
					role: 'user',
					content: {
						type: 'text',
						text: `Please greet ${name} in a friendly manner.`,
					},
				},
			],
		})
	)

	// Register a tool specifically for testing the ability
	// to resume notification streams to the client
	server.registerTool(
		'start-notification-stream',
		{
			title: 'Notification Stream',
			description: 'Starts sending periodic notifications for testing resumability',
			inputSchema: {
				interval: z.number().describe('Interval in milliseconds between notifications').default(100),
				count: z.number().describe('Number of notifications to send (0 for 100)').default(10),
			},
			outputSchema: {
				message: z.string(),
			},
		},
		async ({ interval, count }, { sendNotification }) => {
			const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
			let counter = 0

			while (count === 0 || counter < count) {
				counter++
				try {
					await sendNotification({
						method: 'notifications/message',
						params: {
							level: 'info',
							data: `Periodic notification #${counter} at ${new Date().toISOString()}`,
						},
					})
				} catch (error) {
					console.error('Error sending notification:', error)
				}
				// Wait for the specified interval
				await sleep(interval)
			}

			const output = {
				message: `Started sending periodic notifications every ${interval}ms`,
			}

			return {
				content: [
					{
						type: 'text',
						text: output.message,
					},
				],
				structuredContent: output,
			}
		}
	)

	// Create a resource that can be fetched by the client through
	// this MCP server.
	server.registerResource(
		'greeting-resource',
		'https://example.com/greetings/default',
		{
			title: 'Greeting Resource',
			description: 'A simple greeting resource',
			mimeType: 'text/plain',
		},
		async (uri) => {
			return {
				contents: [
					{
						uri: uri.href,
						text: 'Hello, world!',
					},
				],
			}
		}
	)

	return server
}
