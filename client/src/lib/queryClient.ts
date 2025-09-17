import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // For DELETE requests or empty responses, return null
  if (method === 'DELETE' || res.status === 204) {
    return null;
  }
  
  // Check if response has content and is JSON
  const contentType = res.headers.get('content-type');
  const contentLength = res.headers.get('content-length');
  
  if (contentLength === '0' || !contentType?.includes('application/json')) {
    return null;
  }
  
  // Only parse JSON if we have JSON content
  try {
    return await res.json();
  } catch (error) {
    console.error('JSON parse error:', error);
    return null;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    });

    if (unauthorizedBehavior === "returnNull" && (res.status === 401 || res.status === 403)) {
      return null;
    }

    await throwIfResNotOk(res);
    
    // Handle empty responses or non-JSON content gracefully
    if (res.status === 204) {
      return null as any;
    }
    
    const contentType = res.headers.get('content-type');
    const contentLength = res.headers.get('content-length');
    
    if (contentLength === '0' || !contentType?.includes('application/json')) {
      return null as any;
    }
    
    try {
      return await res.json();
    } catch (error) {
      console.error('JSON parse error in query:', error);
      return null as any;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
