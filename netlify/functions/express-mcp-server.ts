import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { setupMCPServer } from '../mcp-server'
import express from 'express'
import type { Request, Response } from 'express'
import serverless from 'serverless-http'

// Create Express app
const app = express()

// Helper function to handle MCP requests
const handleMCPRequest = async (req: Request, res: Response, method: 'GET' | 'POST') => {
	// In stateless mode, create a new instance of transport and server for each request
	// to ensure complete isolation. A single instance would cause request ID collisions
	// when multiple clients connect concurrently.

	console.log(`Received ${method} MCP request`, method === 'POST' ? { body: req.body } : {})

	try {
		const server = setupMCPServer()
		const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		})
		await server.connect(transport)

		if (method === 'POST') {
			// Parse the body if it's a string
			const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
			await transport.handleRequest(req as any, res, body)
		} else {
			// For GET requests, pass the request and response
			await transport.handleRequest(req as any, res)
		}

		res.on('close', () => {
			console.log(`${method} request closed`)
			transport.close()
			server.close()
		})
	} catch (error) {
		console.error(`Error handling MCP ${method} request:`, error)
		if (!res.headersSent) {
			res.status(500).json({
				jsonrpc: '2.0',
				error: {
					code: -32603,
					message: 'Internal server error',
				},
				id: null,
			})
		}
	}
}

// Use raw body for MCP endpoint to preserve the stream
app.post('/mcp', express.text({ type: '*/*' }), async (req: Request, res: Response) => {
	console.log('POST handler called')
	await handleMCPRequest(req, res, 'POST')
})

app.get('/mcp', async (req: Request, res: Response) => {
	console.log('GET handler called')
	await handleMCPRequest(req, res, 'GET')
})

app.delete('/mcp', (req: Request, res: Response) => {
	console.log('DELETE handler called - returning 405')
	res.status(405).json({
		jsonrpc: '2.0',
		error: {
			code: -32000,
			message: 'Method not allowed.',
		},
		id: null,
	})
})

// Catch-all for debugging
app.all('/mcp', (req: Request, res: Response) => {
	console.log(`Unhandled ${req.method} request to /mcp`)
	res.status(405).json({
		jsonrpc: '2.0',
		error: {
			code: -32000,
			message: `Method ${req.method} not allowed.`,
		},
		id: null,
	})
})

// Apply JSON middleware for other routes
app.use(express.json())

export const handler = serverless(app)
