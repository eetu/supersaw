<script lang="ts">
	let {
		label,
		checked = $bindable()
	}: {
		label: string;
		checked: boolean;
	} = $props();
</script>

<label class="flip">
	<span class="name">{label}</span>
	<input type="checkbox" bind:checked />
	<span class="track" aria-hidden="true"><span class="knob"></span></span>
	<span class="state">{checked ? 'on' : 'off'}</span>
</label>

<style>
	.flip {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		user-select: none;
	}
	.name {
		font-family: var(--halo-font-heading);
		font-size: 0.8rem;
		color: var(--halo-text-muted);
	}
	input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.track {
		display: inline-block;
		width: 2.1rem;
		height: 1.15rem;
		border-radius: 1rem;
		background: var(--halo-off-bg);
		position: relative;
		transition: background var(--halo-d-fast);
	}
	.knob {
		position: absolute;
		top: 0.125rem;
		left: 0.125rem;
		width: 0.9rem;
		height: 0.9rem;
		border-radius: 50%;
		background: var(--halo-bg-main);
		transition: transform var(--halo-d-fast);
	}
	input:checked + .track {
		background: var(--halo-accent);
	}
	input:checked + .track .knob {
		transform: translateX(0.95rem);
	}
	input:focus-visible + .track {
		outline: 2px solid var(--halo-accent);
		outline-offset: 2px;
	}
	.state {
		font-size: 0.75rem;
		color: var(--halo-text-muted);
		width: 1.5rem;
	}
</style>
