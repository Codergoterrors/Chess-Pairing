import { Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Footer() {
  return (
    <footer className="border-t border-border bg-background mt-auto">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-center gap-3 text-sm">
          <p className="text-muted-foreground">Developed by Osm Omkar</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 gap-2 text-pink-500 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/20"
            asChild
          >
            <a
              href="https://www.instagram.com/osmomkar_"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram className="h-4 w-4" />
              <span>Instagram</span>
            </a>
          </Button>
        </div>
      </div>
    </footer>
  );
}
