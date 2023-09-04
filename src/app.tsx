// mostly inspired by playNext.js
// https://github.com/daksh2k/Spicetify-stuff/blob/04dcfe6d31adfabd48427a8bef21473e73db7114/Extensions/playNext.js

async function main() {
  while (!(Spicetify.Queue && Spicetify.ContextMenu && Spicetify.URI)) {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  const uriTrack = (uris: string[]) => {
    if (uris.length > 1) {
      return true
    }
    const uriObj = Spicetify.URI.fromString(uris[0])
    switch (uriObj.type) {
      case Spicetify.URI.Type.TRACK:
      case Spicetify.URI.Type.PLAYLIST:
      case Spicetify.URI.Type.PLAYLIST_V2:
      case Spicetify.URI.Type.ALBUM:
        return true
    }
    return false
  }

  const getToken = () => {
    return Spicetify.Platform.AuthorizationAPI._tokenProvider({
      preferCached: true,
    }).then((res: any) => res.accessToken)
  }

  const fetchAlbumFromWebApi = async (url: string): Promise<string[]> => {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${await getToken()}`,
      },
    })
    const albumDetails = await res.json()
    return [
      ...albumDetails.items.map((item: any) => item.uri),
      ...(!!albumDetails.next ? await fetchAlbumFromWebApi(albumDetails.next) : []),
    ]
  }

  const fetchPlaylist = async (uri: string) => {
    const res = await Spicetify.CosmosAsync.get(
      `sp://core-playlist/v1/playlist/${uri}/rows`,
      {
        policy: { link: true },
      },
    )
    return res.rows.map((item: any) => item.link)
  }

  const shuffle = <T extends any>(array: T[]) => {
    let counter = array.length
    if (counter <= 1) return array

    const first = array[0]

    // While there are elements in the array
    while (counter > 0) {
      // Pick a random index
      let index = Math.floor(Math.random() * counter)

      // Decrease counter by 1
      counter--

      // And swap the last element with it
      let temp = array[counter]
      array[counter] = array[index]
      array[index] = temp
    }

    // Re-shuffle if first item is the same as pre-shuffled first item
    while (array[0] === first) {
      array = shuffle(array)
    }
    return array
  }

  /**
   * Main entry point when clicked from context menu.
   * @param uris List of uris for uniquesly identifying tracks/playlist/album etc.
   * */
  const fetchAndAdd = async (uris: string[]) => {
    const uri = uris[0]
    const uriObj = Spicetify.URI.fromString(uri)
    if (uris.length > 1 || uriObj.type === Spicetify.URI.Type.TRACK) {
      addToQueue(uris)
      return
    }
    let tracks = []
    switch (uriObj.type) {
      case Spicetify.URI.Type.PLAYLIST:
      case Spicetify.URI.Type.PLAYLIST_V2:
        tracks = await fetchPlaylist(uri)
        break
      case Spicetify.URI.Type.ALBUM:
        tracks = await fetchAlbumFromWebApi(
          `https://api.spotify.com/v1/albums/${uri.split(":")[2]}/tracks?limit=50`,
        )
        break
    }
    if (Spicetify.Player.getShuffle()) tracks = shuffle(tracks)
    addToQueue(tracks)
  }

  const addToQueue = async (uris: string[]) => {
    //Check if all uris are valid track uris.
    if (
      !uris.every(
        (uri) => Spicetify.URI.fromString(uri).type === Spicetify.URI.Type.TRACK,
      )
    ) {
      Spicetify.showNotification("Malformed uris!")
      return
    }

    await Spicetify.addToQueue(uris.map((uri) => ({ uri }))).catch((err) => {
      console.error("Failed to add to queue", err)
    })
  }

  new Spicetify.ContextMenu.Item(
    "Add to queue",
    fetchAndAdd,
    uriTrack,
    "playlist",
  ).register()
}

export default main
