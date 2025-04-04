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
): Promise<Response> {
  console.log(`API Request: ${method} ${url}`, data ? { data } : '');
  
  // Enhanced fetch configuration 
  const fetchConfig: RequestInit = {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      "Accept": "application/json"
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", 
    cache: "no-cache",
    mode: "cors",
    redirect: "follow"
  };
  
  console.log("Fetch config:", { ...fetchConfig, body: data ? "DATA" : undefined });
  const res = await fetch(url, fetchConfig);
  
  // Log cookie headers
  console.log(`API Response: ${res.status}`, {
    hasCookieHeader: res.headers.has('set-cookie'),
    ok: res.ok,
    contentType: res.headers.get('content-type')
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    console.log(`Query request: ${queryKey[0]}`);
    
    // Use the same enhanced fetch config as apiRequest
    const fetchConfig: RequestInit = {
      method: 'GET',
      headers: {
        "Accept": "application/json"
      },
      credentials: "include",
      cache: "no-cache",
      mode: "cors",
      redirect: "follow"
    };
    
    console.log("Query fetch config:", fetchConfig);
    const res = await fetch(queryKey[0] as string, fetchConfig);

    console.log(`Query response status: ${res.status}`, {
      hasCookieHeader: res.headers.has('set-cookie'),
      ok: res.ok,
      contentType: res.headers.get('content-type')
    });
    
    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.log("401 Unauthorized - returning null as configured");
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});