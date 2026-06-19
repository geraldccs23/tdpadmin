import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function xmlTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>(.*?)</${tag}>`, 's')
  const m = xml.match(re)
  return m ? m[1].trim() : null
}

function xmlTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>(.*?)</${tag}>`, 'gs')
  const result: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    result.push(m[1].trim())
  }
  return result
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'only POST allowed' }), { status: 405 })
    }

    const ct = req.headers.get('content-type') || ''
    let xml = ''

    if (ct.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData()
      xml = form.get('productos')?.toString() || ''
    } else {
      const body = await req.json()
      xml = body?.productos || ''
    }

    if (!xml) {
      return new Response(JSON.stringify({ ok: false, error: "Missing 'productos'" }), { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const productosXml = xmlTags(xml, 'producto')

    if (!productosXml.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), { status: 200 })
    }

    let processed = 0
    for (const px of productosXml) {
      const codProducto = xmlTag(px, 'codProducto')
      const desProducto = xmlTag(px, 'desProducto')
      const precioUSD = parseFloat(xmlTag(px, 'precioUSD') || '0')
      const estatus = parseInt(xmlTag(px, 'estatus') || '0', 10)
      if (!codProducto) continue

      const descripcion = desProducto || null
      const precio = Number.isFinite(precioUSD) && precioUSD > 0 ? precioUSD : null

      const { error: upsertErr } = await supabase
        .from('products')
        .upsert(
          { codigo_producto: codProducto, descripcion, precio_referencia: precio },
          { onConflict: 'codigo_producto' }
        )
      if (upsertErr) throw upsertErr

      const almacenesXml = xmlTags(px, 'almacen')
      for (const ax of almacenesXml) {
        const code = xmlTag(ax, 'code')
        const location = xmlTag(ax, 'location')
        const qty = parseFloat(xmlTag(ax, 'qty') || '0')
        if (!code || !Number.isFinite(qty)) continue

        const locUpper = (location || '').toUpperCase()
        if (locUpper.includes('BOLEITA') || locUpper.includes('FURIA') || locUpper.includes('002')) {
          await supabase.from('products').update({ stock_boleita: qty }).eq('codigo_producto', codProducto)
        } else if (locUpper.includes('SABANA') || locUpper.includes('GRANDE') || locUpper.includes('003')) {
          await supabase.from('products').update({ stock_sabana_grande: qty }).eq('codigo_producto', codProducto)
        }
      }

      processed++
    }

    return new Response(JSON.stringify({ ok: true, processed }), { status: 200 })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), { status: 500 })
  }
})
