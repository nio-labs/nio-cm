<script setup lang="ts">
import { ref } from 'vue'
import { usePwa } from '../../composables/usePwa'
import AppModal from '../ui/AppModal.vue'
import Button from '../ui/Button.vue'
import { HugeiconsIcon } from '@hugeicons/vue'
import { Settings01Icon } from '@hugeicons/core-free-icons'

const { isOnline, needRefresh, showUpdateDialog, reviewUpdate, dismissUpdate, reloadToUpdate } = usePwa()
const updateDeferred = ref(false)
const updating = ref(false)
const updateError = ref('')

async function update() {
  updating.value = true
  updateError.value = ''
  try {
    await reloadToUpdate()
  } catch (error) {
    updateError.value = 'The update could not be applied. Try again when connected.'
    console.error('PWA update failed', error)
  } finally {
    updating.value = false
  }
}
</script>

<template>
  <div class="fixed bottom-3 left-3 right-3 sm:right-auto sm:max-w-md space-y-2 z-40 text-xs" aria-live="polite">
    <div v-if="!isOnline" role="status" class="rounded-lg border border-border bg-card p-3 shadow-lg">
      <p class="font-medium">You’re offline</p>
      <p class="mt-1 text-muted-foreground">Your workspace layout is saved. Terminals need a connection to the NioCM daemon.</p>
    </div>
    <div v-if="needRefresh && !updateDeferred" class="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-lg">
      <p class="mr-auto">A NioCM update is ready.</p>
      <Button variant="ghost" size="sm" @click="updateDeferred = true">Later</Button>
      <Button size="sm" @click="reviewUpdate">Update</Button>
    </div>
  </div>

  <AppModal v-if="showUpdateDialog" title="Update NioCM" description="Reload when your terminal work is finished." @close="dismissUpdate">
    <template #icon><HugeiconsIcon :icon="Settings01Icon" class="h-4 w-4" /></template>
    <p class="text-muted-foreground">Reloading stops active terminal processes and restores your workspace layout. Finish or save your work before continuing.</p>
    <p v-if="updateError" role="alert" class="mt-3 text-destructive">{{ updateError }}</p>
    <template #footer>
      <Button variant="outline" size="sm" :disabled="updating" @click="dismissUpdate">Later</Button>
      <Button size="sm" :disabled="updating" @click="update">{{ updating ? 'Updating…' : 'Reload and update' }}</Button>
    </template>
  </AppModal>
</template>
