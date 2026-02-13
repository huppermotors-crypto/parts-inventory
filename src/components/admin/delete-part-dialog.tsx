"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Part } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";

interface DeletePartDialogProps {
  part: Part | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (partId: string) => void;
}

const supabase = createClient();

export function DeletePartDialog({
  part,
  open,
  onOpenChange,
  onDeleted,
}: DeletePartDialogProps) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!part) return;

    setDeleting(true);
    try {
      // Delete photos from storage
      if (part.photos && part.photos.length > 0) {
        const paths = part.photos.map((url) => {
          // Extract the path from the full URL
          const match = url.match(/part-photos\/(.+)$/);
          return match ? match[1] : "";
        }).filter(Boolean);

        if (paths.length > 0) {
          await supabase.storage.from("part-photos").remove(paths);
        }
      }

      // Delete the part record
      const { error } = await supabase.from("parts").delete().eq("id", part.id);

      if (error) throw error;

      toast({
        title: "Part Deleted",
        description: `"${part.name}" has been removed from inventory.`,
      });

      onDeleted(part.id);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete part.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Part</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{part?.name}&quot;? This
            action cannot be undone. All associated photos will also be removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
