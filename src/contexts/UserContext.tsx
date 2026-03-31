import { createSupabaseClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { getLocalMockUser, isLocalUIModeEnabled } from "@/lib/mock/local-ui";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type UserContentType = {
  getUser: () => Promise<User | undefined>;
  user: User | undefined;
  loading: boolean;
};

const UserContext = createContext<UserContentType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>();
  const [loading, setLoading] = useState(true);

  const getUser = useCallback(async () => {
    if (isLocalUIModeEnabled()) {
      const localUser = getLocalMockUser();
      setUser(localUser);
      setLoading(false);
      return localUser;
    }

    if (user) {
      setLoading(false);
      return user;
    }

    const supabase = createSupabaseClient();

    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();
    setUser(supabaseUser || undefined);
    setLoading(false);
    return supabaseUser || undefined;
  }, [user]);

  useEffect(() => {
    if (user || typeof window === "undefined") return;
    void getUser();
  }, [getUser, user]);

  const contextValue: UserContentType = useMemo(
    () => ({
      getUser,
      user,
      loading,
    }),
    [getUser, loading, user]
  );

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
}
