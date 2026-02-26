import { useEffect, useMemo, useState } from "react";

import { searchUsers } from "../../lib/api";
import { Button } from "../ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

type UserSearchItem = {
  id: string;
  username: string;
  email: string;
  displayName: string;
};

type UserSearchComboboxProps = {
  accessToken: string;
  onSelect: (user: UserSearchItem) => void;
  placeholder?: string;
};

export function UserSearchCombobox({ accessToken, onSelect, placeholder = "Search users..." }: UserSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<UserSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (!open || normalizedQuery.length < 2) {
      setItems([]);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await searchUsers(accessToken, normalizedQuery);
        if (!cancelled) {
          setItems(payload.items);
        }
      } catch (searchError) {
        if (!cancelled) {
          setError(searchError instanceof Error ? searchError.message : "Unable to search users");
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [accessToken, normalizedQuery, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" className="w-full justify-start text-left font-normal">
          {placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search by name, username, or email" />
          <CommandList>
            {loading ? <div className="px-3 py-2 text-sm">Searching...</div> : null}
            {error ? <div className="px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</div> : null}
            {!loading && !error && normalizedQuery.length < 2 ? <div className="px-3 py-2 text-sm">Type at least 2 characters</div> : null}
            {!loading && !error && normalizedQuery.length >= 2 ? (
              <>
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                  {items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`${item.displayName} ${item.username} ${item.email}`}
                      onSelect={() => {
                        onSelect(item);
                        setQuery("");
                        setOpen(false);
                      }}
                    >
                      <div className="grid">
                        <span className="text-sm font-medium">{item.displayName}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {item.username} · {item.email}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
