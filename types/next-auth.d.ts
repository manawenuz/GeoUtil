import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  /**
   * Extends the built-in session types to include user ID
   */
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image: string;
    };
  }

  /**
   * Extends the built-in user types
   */
  interface User {
    id: string;
    email: string;
    name: string;
    image?: string;
  }
}

declare module "next-auth/jwt" {
  /**
   * Extends the JWT token to include user ID
   */
  interface JWT {
    id: string;
    email: string;
    name: string;
    picture: string;
  }
}
