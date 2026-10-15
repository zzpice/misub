<template>
    <div class="settings-layout">
        <aside class="settings-navigation"><slot name="sidebar" /></aside>
        <div class="settings-main">
            <div class="settings-sections"><slot /></div>
            <div class="settings-save"><slot name="footer" /></div>
        </div>
    </div>
</template>
