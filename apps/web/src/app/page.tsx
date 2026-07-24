"use client"

import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export default function Home() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">FestGrid Design System Verification</h1>
        <Button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          Toggle Theme
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Theme Colors</CardTitle>
            <CardDescription>Primary, Secondary, Accent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="default">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">Accent</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="destructive">Destructive</Button>
              <Button className="bg-success text-success-foreground hover:bg-success/90">Success</Button>
            </div>
            <div className="flex gap-2">
              <Button className="bg-wizard-primary text-primary-foreground hover:bg-wizard-primary/90">Wizard Primary</Button>
              <Button className="bg-wizard-secondary text-primary-foreground hover:bg-wizard-secondary/90">Wizard Secondary</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Button States</CardTitle>
            <CardDescription>Verify disabled styling</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button disabled>Disabled Button</Button>
          </CardContent>
          <CardFooter>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dialog verification</DialogTitle>
                  <DialogDescription>
                    This verifies that modal patterns and dialog styling work as intended with the base border radius.
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}