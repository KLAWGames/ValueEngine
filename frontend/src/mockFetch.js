// mockFetch.js - Global Fetch Interceptor for Local-First Emulation
// Intercepts all '/api/*' requests and routes them to localDb when USE_LOCAL_DB is active.

import * as localDb from './localDb';

const USE_LOCAL_DB = localStorage.getItem('USE_LOCAL_DB') !== 'false';

if (USE_LOCAL_DB) {
  console.log('🔌 Local-First Database Emulator is active (saving to browser localStorage).');
  localDb.initDb();

  const originalFetch = window.fetch;

  window.fetch = async function (input, init = {}) {
    const urlStr = typeof input === 'string' ? input : input.url;
    
    // Only intercept '/api/' requests
    if (!urlStr.includes('/api/')) {
      return originalFetch.apply(this, arguments);
    }

    const method = (init.method || 'GET').toUpperCase();
    const url = new URL(urlStr, window.location.origin);
    const pathname = url.pathname;
    const body = init.body ? JSON.parse(init.body) : null;

    // Helper to return a mock JSON response
    const mockResponse = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const mockError = (message, status = 400) => {
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    try {
      // 1. AUTH ROUTES
      if (pathname === '/api/auth/register' && method === 'POST') {
        const result = localDb.register(body.email, body.password);
        return mockResponse(result, 201);
      }
      
      if (pathname === '/api/auth/login' && method === 'POST') {
        const result = localDb.login(body.email, body.password);
        return mockResponse(result, 200);
      }

      if (pathname === '/api/auth/me' && method === 'GET') {
        const users = JSON.parse(localStorage.getItem('ldb_users') || '[]');
        // Return first mock user
        const user = users[0] || { email: 'local@user.com' };
        return mockResponse({ user: { user_id: user.user_id, email: user.email } });
      }

      // 2. SUBSCRIPTIONS ROUTES
      if (pathname === '/api/subscriptions') {
        if (method === 'GET') {
          return mockResponse(localDb.getSubscriptions());
        }
        if (method === 'POST') {
          return mockResponse(localDb.createSubscription(body), 201);
        }
      }

      if (pathname.startsWith('/api/subscriptions/')) {
        const id = pathname.split('/').pop();
        if (method === 'PUT') {
          return mockResponse(localDb.updateSubscription(id, body));
        }
        if (method === 'DELETE') {
          return mockResponse(localDb.deleteSubscription(id));
        }
      }

      // 3. GAMES ROUTES
      if (pathname === '/api/games') {
        if (method === 'GET') {
          return mockResponse(localDb.getGames());
        }
        if (method === 'POST') {
          return mockResponse(localDb.createGame(body), 201);
        }
      }

      if (pathname === '/api/games/linear-sort' && method === 'POST') {
        return mockResponse(localDb.recordLinearSort(body.game_id, body.insert_index));
      }

      if (pathname === '/api/games/suggest-categories' && method === 'GET') {
        // Return empty suggestions or standard tags
        return mockResponse([]);
      }

      if (pathname.startsWith('/api/games/')) {
        const parts = pathname.split('/');
        const id = parts[3]; // /api/games/:id/...
        
        // Path matches: /api/games/:id
        if (parts.length === 4) {
          if (method === 'PUT') {
            return mockResponse(localDb.updateGame(id, body));
          }
          if (method === 'DELETE') {
            return mockResponse(localDb.deleteGame(id));
          }
        }

        // Path matches: /api/games/:id/logs
        if (parts.length === 5 && parts[4] === 'logs') {
          if (method === 'GET') {
            return mockResponse(localDb.getPlayLogs(id));
          }
          if (method === 'POST') {
            return mockResponse(localDb.createPlayLog(id, body), 201);
          }
        }

        // Path matches: /api/games/:id/purchases
        if (parts.length === 5 && parts[4] === 'purchases') {
          if (method === 'GET') {
            return mockResponse(localDb.getPurchases(id));
          }
          if (method === 'POST') {
            return mockResponse(localDb.createPurchase(id, body), 201);
          }
        }
      }

      // Delete logs / purchases by direct ID
      if (pathname.startsWith('/api/logs/') && method === 'DELETE') {
        const id = pathname.split('/').pop();
        return mockResponse(localDb.deletePlayLog(id));
      }

      if (pathname.startsWith('/api/purchases/') && method === 'DELETE') {
        const id = pathname.split('/').pop();
        return mockResponse(localDb.deletePurchase(id));
      }

      // 4. PAIRWISE ENGINE ROUTES
      if (pathname === '/api/pairwise/match') {
        if (method === 'GET') {
          return mockResponse(localDb.getPairwiseMatch());
        }
        if (method === 'POST') {
          const res = localDb.recordPairwiseMatch(
            body.chosen_game_id,
            body.game_a_id,
            body.game_b_id,
            body.prompt_type,
            body.reason_pillar
          );
          return mockResponse(res);
        }
      }

      if (pathname === '/api/pairwise/sort' && method === 'POST') {
        return mockResponse(localDb.recordPairwiseSort(body.sorted_game_ids, body.recommendations));
      }

      // 5. MOODS ROUTES
      if (pathname === '/api/moods') {
        if (method === 'POST') {
          return mockResponse(localDb.createMood(body), 201);
        }
      }

      if (pathname === '/api/moods/timeline' && method === 'GET') {
        return mockResponse(localDb.getMoodTimeline());
      }

      // 6. CATEGORIES ROUTES
      if (pathname === '/api/categories' && method === 'GET') {
        return mockResponse(localDb.getCategories());
      }

      // If we matched /api/ but didn't handle it
      console.warn(`⚠️ Unhandled mock API request: ${method} ${pathname}`);
      return mockError(`Route ${pathname} not emulated`, 404);

    } catch (e) {
      console.error(`❌ Mock API Error:`, e);
      return mockError(e.message, 500);
    }
  };
}
