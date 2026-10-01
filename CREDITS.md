# Credits

3D characters (embedded via `tools/prepare_model.py`):

| Runner   | Model                         | Source (check each licence before release) |
|----------|-------------------------------|--------------------------------------------|
| JAKE     | Ready Player Me sample avatar | three.js examples (`readyplayer.me.glb`)    |
| MIA      | "Michelle"                    | Mixamo / Adobe, three.js examples           |
| VANGUARD | Soldier ("Vanguard")          | Mixamo / Adobe, three.js examples           |
| KAI      | skater-male                   | pmndrs/market-assets (Kenney-style, CC0 listed by that repo) |
| NOVA     | skater-female                 | pmndrs/market-assets (same pack)            |
| ELLA     | "brunette" avatar             | met4citizen/TalkingHead `avatars/brunette.glb` (Ready Player Me) |
| SASHA    | Avaturn avatar                | met4citizen/TalkingHead `avatars/avaturn.glb` |
| FINN     | AvatarSDK avatar              | met4citizen/TalkingHead `avatars/avatarsdk.glb` |

Run and idle animations for every character except VANGUARD come from the
three.js "Xbot" Mixamo animation set, retargeted with `tools/retarget_dir.py`.

Mixamo assets may be used in apps but not redistributed on their own. The avatar
files come from third-party SDKs/samples whose terms may restrict commercial
use. Re-check every licence before releasing the game, or replace the models
with your own.

To add a runner: put the `.glb` somewhere, retarget animations if it has none
(`python3 tools/retarget_dir.py target.glb source.glb out.glb run,idle`), run
`python3 tools/prepare_model.py out.glb name 256 run,idle`, then add an entry
to `game/characters.ts`.
