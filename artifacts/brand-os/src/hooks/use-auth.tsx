import { createContext, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe, useGetPreferences, getGetMeQueryKey, getGetPreferencesQueryKey } from "@workspace/api-client-react";
import type { UserResponse, PreferencesResponse } from "@workspace/api-client-react";

interface AuthContextType {
  user: UserResponse | undefined;
  preferences: PreferencesResponse | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  invalidate: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: undefined,
  preferences: undefined,
  isLoading: true,
  isAuthenticated: false,
  invalidate: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useGetMe({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { queryKey: getGetMeQueryKey(), retry: false, staleTime: 5 * 60 * 1000 } as any,
  });

  const { data: preferences, isLoading: prefsLoading } = useGetPreferences({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { queryKey: getGetPreferencesQueryKey(), enabled: !!user, retry: false, staleTime: 5 * 60 * 1000 } as any,
  });

  const isLoading = userLoading || (!!user && prefsLoading);

  const invalidate = async () => {
    await queryClient.invalidateQueries();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        preferences,
        isLoading,
        isAuthenticated: !!user,
        invalidate,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
