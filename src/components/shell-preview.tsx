"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ShellPreview({
  canOpenStudio = true,
}: {
  canOpenStudio?: boolean;
}) {
  const defaultTab = canOpenStudio ? "studio" : "run";
  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Dynadoc</CardTitle>
        <CardDescription>
          Roles are enforced on the server. Operators do not see Author Studio.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Input placeholder="Sample text field" aria-label="Sample text field" />
        <Select defaultValue="author">
          <SelectTrigger aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="author">Author</SelectItem>
            <SelectItem value="operator">Operator</SelectItem>
          </SelectContent>
        </Select>
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            {canOpenStudio ? (
              <TabsTrigger value="studio">Studio</TabsTrigger>
            ) : null}
            <TabsTrigger value="run">Run</TabsTrigger>
          </TabsList>
          {canOpenStudio ? (
            <TabsContent value="studio">
              Template authoring will live here.
            </TabsContent>
          ) : null}
          <TabsContent value="run">
            Operators will fill published types here.
          </TabsContent>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger render={<Button />}>Open dialog</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dialog</DialogTitle>
                <DialogDescription>shadcn dialog is wired.</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>
              Open sheet
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Sheet</SheetTitle>
                <SheetDescription>shadcn sheet is wired.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="secondary" />}>
              Menu
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Placeholder action</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
