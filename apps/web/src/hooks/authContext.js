import { createContext } from "react";

/** { session, loading, signOut } — provided by app/AuthProvider.jsx. */
export const AuthContext = createContext(null);
