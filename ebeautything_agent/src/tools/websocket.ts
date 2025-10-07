/**
 * WebSocket Tool
 * Provides Socket.io client for real-time testing
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from '../config/agent.config';
import { logger } from '../utils/logger';

let socket: Socket | null = null;
const receivedMessages: any[] = [];

/**
 * WebSocket Connect Tool
 */
export const websocketConnectTool = tool({
  name: 'websocket-connect',
  description: 'Connect to WebSocket server with authentication',
  inputSchema: z.object({
    token: z.string().optional().describe('JWT token for authentication'),
    namespace: z.string().optional().default('/').describe('Socket.io namespace')
  }),
  handler: async (input) => {
    try {
      if (socket?.connected) {
        return {
          success: true,
          message: 'Already connected',
          socketId: socket.id
        };
      }

      const url = `${BACKEND_URL}${input.namespace}`;

      socket = io(url, {
        auth: input.token ? { token: input.token } : undefined,
        transports: ['websocket'],
        reconnection: true
      });

      return new Promise((resolve) => {
        socket!.on('connect', () => {
          logger.info('WebSocket connected', { socketId: socket!.id });
          resolve({
            success: true,
            socketId: socket!.id,
            message: 'Connected to WebSocket server'
          });
        });

        socket!.on('connect_error', (error) => {
          logger.error('WebSocket connection failed', { error: error.message });
          resolve({
            success: false,
            error: error.message
          });
        });

        // Auto-disconnect after 60 seconds
        setTimeout(() => {
          if (!socket?.connected) {
            resolve({
              success: false,
              error: 'Connection timeout'
            });
          }
        }, 60000);
      });
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});

/**
 * WebSocket Emit Tool
 */
export const websocketEmitTool = tool({
  name: 'websocket-emit',
  description: 'Emit an event to the WebSocket server',
  inputSchema: z.object({
    event: z.string().describe('Event name'),
    data: z.any().optional().describe('Event data')
  }),
  handler: async (input) => {
    try {
      if (!socket?.connected) {
        return {
          success: false,
          error: 'Not connected to WebSocket server'
        };
      }

      socket.emit(input.event, input.data);

      logger.info('WebSocket event emitted', {
        event: input.event,
        hasData: !!input.data
      });

      return {
        success: true,
        message: `Emitted ${input.event} event`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});

/**
 * WebSocket Listen Tool
 */
export const websocketListenTool = tool({
  name: 'websocket-listen',
  description: 'Listen for WebSocket events and collect messages',
  inputSchema: z.object({
    events: z.array(z.string()).describe('Events to listen for'),
    duration: z.number().optional().default(5000).describe('Duration to listen in ms')
  }),
  handler: async (input) => {
    try {
      if (!socket?.connected) {
        return {
          success: false,
          error: 'Not connected to WebSocket server'
        };
      }

      receivedMessages.length = 0; // Clear previous messages

      // Set up listeners
      const listeners: any[] = [];
      for (const event of input.events) {
        const listener = (data: any) => {
          receivedMessages.push({
            event,
            data,
            timestamp: new Date().toISOString()
          });
        };
        socket.on(event, listener);
        listeners.push({ event, listener });
        logger.info('Listening for event', { event });
      }

      // Wait for duration
      await new Promise(resolve => setTimeout(resolve, input.duration));

      // Remove listeners
      for (const { event, listener } of listeners) {
        socket.off(event, listener);
      }

      logger.info('WebSocket messages collected', {
        count: receivedMessages.length,
        events: input.events
      });

      return {
        success: true,
        messages: [...receivedMessages],
        count: receivedMessages.length
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});

/**
 * WebSocket Disconnect Tool
 */
export const websocketDisconnectTool = tool({
  name: 'websocket-disconnect',
  description: 'Disconnect from WebSocket server',
  inputSchema: z.object({
    confirm: z.boolean().optional().default(true)
  }),
  handler: async (input) => {
    try {
      if (!socket) {
        return {
          success: true,
          message: 'Already disconnected'
        };
      }

      socket.disconnect();
      socket = null;
      receivedMessages.length = 0;

      logger.info('WebSocket disconnected');

      return {
        success: true,
        message: 'Disconnected from WebSocket server'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});

export const websocketTool = {
  connect: websocketConnectTool,
  emit: websocketEmitTool,
  listen: websocketListenTool,
  disconnect: websocketDisconnectTool
};
