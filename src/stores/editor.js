import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useEditorStore = defineStore('editor', () => {
    const isDirty = ref(false);
    const revision = ref(0);
    const isLoading = ref(false);
    const lastUpdated = ref(null);

    function markDirty() {
        revision.value += 1;
        isDirty.value = true;
    }

    function clearDirty() {
        isDirty.value = false;
    }

    function setLoading(loading) {
        isLoading.value = loading;
    }

    function setLastUpdated(date) {
        lastUpdated.value = date;
    }

    return {
        isDirty,
        revision,
        isLoading,
        lastUpdated,
        markDirty,
        clearDirty,
        setLoading,
        setLastUpdated,
    };
});
