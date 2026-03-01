import { Bell, Home, Settings, Shield, User, Users, UserCog } from "lucide-react";

import type { NavigationMenuConfig } from "../components/navigation-menu";

export function createAppHeaderNavigationMenuConfig(): NavigationMenuConfig {
  return {
    sections: [
      {
        id: "primary",
        title: "Primary",
        items: [
          {
            id: "header-home",
            label: "Home",
            icon: Home,
            path: "/",
            pathPatterns: ["/"],
          },
        ]
      }
    ],
  };
}
